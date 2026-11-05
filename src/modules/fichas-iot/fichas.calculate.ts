import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { Forecast, Metric, Reading, Row, Schedule } from './fichas.types';
const minute = 60000;
const day = 86400000;
const time = (s: string) => new Date(s).getTime();
const iso = (t: number) => new Date(t).toISOString();
export const validMoisture = (n: number | null): n is number =>
  n !== null && Number.isFinite(n) && n >= 0 && n <= 100;
const compareId = (a: string, b: string) =>
  /^\d+$/.test(a) && /^\d+$/.test(b)
    ? BigInt(a) < BigInt(b)
      ? -1
      : BigInt(a) > BigInt(b)
        ? 1
        : 0
    : a.localeCompare(b);
export function deduplicate(input: Reading[]) {
  const messages = new Set<string>();
  const dates = new Set<string>();
  return [...input]
    .sort(
      (a, b) =>
        time(a.receivedAt) - time(b.receivedAt) || compareId(a.id, b.id),
    )
    .filter((r) => {
      const message = r.messageId ? `${r.sensorId}:${r.messageId}` : null;
      const date = r.at ? `${r.sensorId}:${r.at}` : null;
      if ((message && messages.has(message)) || (date && dates.has(date)))
        return false;
      if (message) messages.add(message);
      if (date) dates.add(date);
      return true;
    })
    .sort(
      (a, b) =>
        time(a.at || a.receivedAt) - time(b.at || b.receivedAt) ||
        compareId(a.id, b.id),
    );
}
// Arrays are ordered by measurement time, then ID. Binary search avoids row-by-row scans.
export function nearest(
  rows: Reading[],
  target: number,
  tolerance: number,
): Reading | undefined {
  let lo = 0;
  let hi = rows.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (time(rows[mid].at!) < target) lo = mid + 1;
    else hi = mid;
  }
  const candidates = [rows[lo - 1], rows[lo]].filter((r): r is Reading =>
    Boolean(r),
  );
  return candidates
    .filter((r) => Math.abs(time(r.at!) - target) <= tolerance)
    .sort(
      (a, b) =>
        Math.abs(time(a.at!) - target) - Math.abs(time(b.at!) - target) ||
        time(a.at!) - time(b.at!) ||
        compareId(a.id, b.id),
    )[0];
}
export function calculate(input: {
  start: string;
  end: string;
  cutoff: string;
  readings: Reading[];
  temperature: Reading[];
  humidity: Reading[];
  irrigations: string[];
  forecasts: Forecast[];
  schedule: Schedule[];
  tolerance: number;
  acquisitionTolerance: number;
}) {
  const start = time(input.start);
  const end = time(input.end);
  const cutoff = time(input.cutoff);
  const readings = deduplicate(input.readings);
  const within = (r: Reading) =>
    time(r.at || r.receivedAt) >= start && time(r.at || r.receivedAt) <= end;
  const period = readings.filter(within);
  const valid = readings.filter((r) => r.at && validMoisture(r.value));
  const validPeriod = valid.filter(within);
  const temperature = deduplicate(input.temperature).filter(
    (r) => r.at && r.value !== null && Number.isFinite(r.value),
  );
  const humidity = deduplicate(input.humidity).filter(
    (r) => r.at && validMoisture(r.value),
  );
  const irrigations = [...input.irrigations].map(time).sort((a, b) => a - b);
  const lastIrrigation = (at: number) => {
    let lo = 0;
    let hi = irrigations.length;
    while (lo < hi) {
      const m = (lo + hi) >>> 1;
      if (irrigations[m] <= at) lo = m + 1;
      else hi = m;
    }
    return lo ? iso(irrigations[lo - 1]) : null;
  };
  const schedules = [...input.schedule].sort(
    (a, b) => time(a.desde) - time(b.desde),
  );
  if (
    schedules.some(
      (s, i) =>
        !Number.isFinite(time(s.desde)) ||
        s.intervaloMinutos <= 0 ||
        !Number.isFinite(s.intervaloMinutos) ||
        (i > 0 && s.desde === schedules[i - 1].desde),
    )
  )
    throw new BadRequestException('Historial de adquisición inválido');
  const slots: number[] = [];
  const intervals: number[] = [];
  for (let i = 0; i < schedules.length; i++) {
    const s = schedules[i];
    const anchor = time(s.desde);
    const step = s.intervaloMinutos * minute;
    const stop = Math.min(
      end,
      i + 1 < schedules.length ? time(schedules[i + 1].desde) - 1 : end,
    );
    let cursor =
      anchor + Math.max(0, Math.ceil((start - anchor) / step)) * step;
    for (; cursor <= stop; cursor += step) {
      if (slots.length >= 20000)
        throw new PayloadTooLargeException(
          'El periodo supera 20 000 horarios esperados. Divídelo en fichas; no se ha truncado ningún registro.',
        );
      slots.push(cursor);
      intervals.push(step);
    }
  }
  const completeSchedule = Boolean(
    schedules.length && time(schedules[0].desde) <= start,
  );
  const assigned = new Map<number, Reading>();
  const used = new Set<string>();
  for (const r of period.filter((r) => r.at)) {
    const at = time(r.at!);
    let lo = 0;
    let hi = slots.length;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (slots[mid] < at) lo = mid + 1;
      else hi = mid;
    }
    const slot = [lo - 1, lo]
      .filter((i) => i >= 0 && i < slots.length)
      .sort(
        (a, b) =>
          Math.abs(slots[a] - at) - Math.abs(slots[b] - at) ||
          slots[a] - slots[b],
      )[0];
    if (slot === undefined) continue;
    const distance = Math.abs(slots[slot] - at);
    const halfGap =
      Math.min(
        intervals[slot],
        slot > 0 ? slots[slot] - slots[slot - 1] : Infinity,
        slot + 1 < slots.length ? slots[slot + 1] - slots[slot] : Infinity,
      ) / 2;
    if (distance > Math.min(input.acquisitionTolerance * minute, halfGap))
      continue;
    const prior = assigned.get(slot);
    if (!prior || distance < Math.abs(time(prior.at!) - slots[slot])) {
      if (prior) used.delete(prior.id);
      assigned.set(slot, r);
      used.add(r.id);
    }
  }
  const makeRow = (scheduled: number | null, reading?: Reading): Row => {
    const at = reading?.at ? time(reading.at) : null;
    const temp =
      at === null
        ? undefined
        : nearest(temperature, at, input.acquisitionTolerance * minute);
    const humid =
      at === null
        ? undefined
        : nearest(humidity, at, input.acquisitionTolerance * minute);
    return {
      numero: 0,
      programada: scheduled === null ? null : iso(scheduled),
      medicion: reading?.at ?? null,
      recibida: reading?.receivedAt ?? null,
      recibido: reading ? 1 : 0,
      humedad: reading && validMoisture(reading.value) ? reading.value : null,
      temperatura: temp?.value ?? null,
      humedadRelativa: humid?.value ?? null,
      ultimoRiego: lastIrrigation(at ?? scheduled ?? time(reading!.receivedAt)),
      observaciones: [
        reading?.note,
        !reading ? 'Lectura faltante' : '',
        reading && !validMoisture(reading.value)
          ? 'Humedad inválida: excluida de indicadores'
          : '',
        scheduled === null ? 'Sin asociación a horario programado' : '',
        temp && temp.at !== reading?.at ? `Temperatura medida ${temp.at}` : '',
        humid && humid.at !== reading?.at
          ? `Humedad relativa medida ${humid.at}`
          : '',
      ]
        .filter(Boolean)
        .join('; '),
    };
  };
  const a = slots.map((s, i) => makeRow(s, assigned.get(i)));
  const unassociated = period.filter((r) => !used.has(r.id));
  a.push(...unassociated.map((r) => makeRow(null, r)));
  a.sort(
    (x, y) =>
      time(String(x.programada || x.medicion || x.recibida)) -
      time(String(y.programada || y.medicion || y.recibida)),
  );
  a.forEach((r, i) => {
    r.numero = i + 1;
  });
  const forecasts = input.forecasts.filter(
    (f) =>
      time(f.issuedAt) >= start &&
      time(f.issuedAt) <= end &&
      validMoisture(f.value),
  );
  const b: Row[] = forecasts.map((f) => {
    const target = time(f.issuedAt) + f.horizon * 3600000;
    const pending = target > cutoff;
    const observed = pending
      ? undefined
      : nearest(valid, target, input.tolerance * minute);
    const ea = observed ? Math.abs(observed.value! - f.value) : null;
    return {
      codigo: f.id,
      emision: f.issuedAt,
      modelo: f.model,
      version: f.version,
      horizonte: f.horizon,
      objetivo: iso(target),
      predicha: f.value,
      observada: observed?.value ?? null,
      observacion: observed?.at ?? null,
      desfase: observed ? (time(observed.at!) - target) / minute : null,
      ea,
      epa:
        observed && observed.value !== 0 ? (ea! / observed.value!) * 100 : null,
      estado: pending
        ? 'Pendiente'
        : observed
          ? 'Verificada'
          : 'Sin observación válida',
      motivo: pending
        ? 'La fecha objetivo no se ha cumplido al corte'
        : !observed
          ? 'Sin lectura válida dentro de la tolerancia al corte'
          : observed.value === 0
            ? 'EPA no calculable: observación igual a cero'
            : '',
      conjunto: f.evaluationSet ?? null,
    };
  });
  const c: Metric[] = [];
  const metric = (
    group: string,
    label: string,
    value: number | string | null,
    unit = '',
    reason = '',
    status: Metric['status'] = 'Sin dato',
  ) =>
    c.push({
      group,
      label,
      value,
      unit,
      status: value === null ? status : 'Disponible',
      reason,
    });
  const scheduleReason = completeSchedule
    ? ''
    : 'No existe programación completa para el periodo';
  metric(
    'Adquisición',
    'Registros esperados',
    completeSchedule ? slots.length : null,
    'registros',
    scheduleReason,
  );
  metric(
    'Adquisición',
    'Recibidos únicos asociados',
    completeSchedule ? assigned.size : null,
    'registros',
    scheduleReason,
  );
  const canRate = completeSchedule && slots.length > 0;
  metric(
    'Adquisición',
    'Disponibilidad',
    canRate ? (assigned.size / slots.length) * 100 : null,
    '%',
    canRate ? '' : scheduleReason || 'Cero registros esperados',
    'No calculable',
  );
  metric(
    'Adquisición',
    'Pérdida',
    canRate ? ((slots.length - assigned.size) / slots.length) * 100 : null,
    '%',
    canRate ? '' : scheduleReason || 'Cero registros esperados',
    'No calculable',
  );
  const first = validPeriod[0];
  const last = validPeriod.at(-1);
  const elapsed = first && last ? (time(last.at!) - time(first.at!)) / day : 0;
  metric(
    'Adquisición',
    'Intervalo medio',
    validPeriod.length >= 2
      ? (time(last!.at!) - time(first.at!)) / (validPeriod.length - 1) / minute
      : null,
    'min',
    validPeriod.length < 2 ? 'Se requieren dos mediciones válidas' : '',
    'No calculable',
  );
  metric(
    'Estado hídrico',
    'Humedad al cierre',
    last?.value ?? null,
    '%',
    last ? '' : 'Sin mediciones válidas fechadas',
  );
  metric('Estado hídrico', 'Fecha de humedad al cierre', last?.at ?? null);
  metric(
    'Estado hídrico',
    'Humedad mínima',
    validPeriod.length ? Math.min(...validPeriod.map((r) => r.value!)) : null,
    '%',
  );
  metric(
    'Estado hídrico',
    'Humedad máxima',
    validPeriod.length ? Math.max(...validPeriod.map((r) => r.value!)) : null,
    '%',
  );
  metric('Estado hídrico', 'Humedad inicial', first?.value ?? null, '%');
  metric('Estado hídrico', 'Humedad final', last?.value ?? null, '%');
  metric('Estado hídrico', 'Fecha inicial utilizada', first?.at ?? null);
  metric(
    'Variación hídrica',
    'Variación',
    first && last ? last.value! - first.value! : null,
    'pp',
  );
  metric(
    'Variación hídrica',
    'Tasa de disminución',
    elapsed > 0 ? (first.value! - last!.value!) / elapsed : null,
    'pp/día',
    elapsed > 0 ? '' : 'Se requieren dos mediciones en fechas distintas',
    'No calculable',
  );
  const irrigation = lastIrrigation(end);
  metric(
    'Variación hídrica',
    'Días desde último riego',
    irrigation ? (end - time(irrigation)) / day : null,
    'días',
    irrigation ? '' : 'No hay un riego ejecutado registrado antes del cierre',
  );
  metric('Variación hídrica', 'Último riego al cierre', irrigation);
  for (const horizon of [24, 48]) {
    const verified = b.filter(
      (r) => r.horizonte === horizon && r.estado === 'Verificada',
    );
    const identified = verified.filter((r) => r.conjunto);
    // Each identified temporal set is reported independently, never mixed with operational pairs.
    const sets = [...new Set(identified.map((r) => String(r.conjunto)))];
    const scopes = sets.length
      ? sets.map((set) => ({
          label: `Evaluación temporal ${set}`,
          rows: identified.filter((r) => r.conjunto === set),
        }))
      : [
          {
            label: 'Métricas operativas del periodo (no conjunto de prueba)',
            rows: verified,
          },
        ];
    for (const scope of scopes) {
      const group = `${horizon} h · ${scope.label}`;
      const pairs = scope.rows;
      const n = pairs.length;
      const sumSquares = pairs.reduce((s, p) => s + Number(p.ea) ** 2, 0);
      const mean = n
        ? pairs.reduce((s, p) => s + Number(p.observada), 0) / n
        : 0;
      const sst = pairs.reduce(
        (s, p) => s + (Number(p.observada) - mean) ** 2,
        0,
      );
      metric(group, 'Pares válidos', n, 'pares');
      metric(
        group,
        'MAE',
        n ? pairs.reduce((s, p) => s + Number(p.ea), 0) / n : null,
        'pp',
        n ? '' : 'Sin pares verificados',
      );
      metric(
        group,
        'RMSE',
        n ? Math.sqrt(sumSquares / n) : null,
        'pp',
        n ? '' : 'Sin pares verificados',
      );
      metric(
        group,
        'R²',
        n >= 2 && sst > 0 ? 1 - sumSquares / sst : null,
        '',
        n < 2
          ? 'Se requieren al menos dos pares'
          : sst === 0
            ? 'Observaciones constantes'
            : '',
        'No calculable',
      );
    }
  }
  for (const m of c)
    if (m.value === null && !m.reason)
      m.reason = 'Sin mediciones de origen suficientes';
  return {
    a,
    b,
    c,
    counts: {
      a: a.length,
      b: b.length,
      duplicates: input.readings.filter(within).length - period.length,
      unassociated: unassociated.length,
    },
    completeSchedule,
  };
}
