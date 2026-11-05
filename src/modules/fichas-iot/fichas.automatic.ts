import { BadRequestException, Injectable } from '@nestjs/common';
import { IsDateString, IsIn, IsOptional } from 'class-validator';
import { PrismaService } from '../../config/prisma/prisma.service';
import { parcelaAccess } from '../../common/shared/parcela-access';
import { Column, Row, Snapshot } from './fichas.types';
export class AutomaticQuery {
  @IsOptional() @IsDateString() desde?: string;
  @IsOptional() @IsDateString() hasta?: string;
  @IsOptional() @IsIn(['1', '2', '3', '4', '5']) ficha?: string;
}
export interface AutomaticTable {
  id: string;
  title: string;
  description: string;
  columns: Column[];
  rows: Row[];
  notes: string[];
}
const columns = (items: string[][]): Column[] =>
  items.map(([key, label]) => ({ key, label }));
const number = (v: unknown): number | null => (v == null ? null : Number(v));
const meta = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
@Injectable()
export class AutomaticFichasService {
  constructor(private readonly prisma: PrismaService) {}
  async collect(userId: string, query: AutomaticQuery) {
    const cutoff = new Date();
    const start = query.desde ? new Date(query.desde) : undefined;
    const end = query.hasta ? new Date(query.hasta) : cutoff;
    if ((start && start > end) || end > cutoff)
      throw new BadRequestException(
        'Revisa el rango de fechas: el inicio debe ser anterior al fin y no puede incluir fechas futuras.',
      );
    const period = { ...(start ? { gte: start } : {}), lte: end };
    const access = parcelaAccess(userId);
    const [sensors, readings, irrigations, predictions] =
      await this.prisma.$transaction(
        async (tx) =>
          Promise.all([
            tx.sensores.findMany({
              where: { dispositivos: { parcelas: access } },
              include: {
                tipos_sensor: true,
                dispositivos: { include: { parcelas: true } },
              },
              orderBy: { id: 'asc' },
            }),
            tx.lecturas.findMany({
              where: {
                sensores: { dispositivos: { parcelas: access } },
                recorded_at: period,
                created_at: { lte: cutoff },
              },
              include: {
                sensores: {
                  include: {
                    tipos_sensor: true,
                    dispositivos: { include: { parcelas: true } },
                  },
                },
              },
              orderBy: [{ recorded_at: 'asc' }, { id: 'asc' }],
            }),
            tx.riegos.findMany({
              where: {
                parcelas: access,
                inicio: period,
                created_at: { lte: cutoff },
              },
              include: { parcelas: true },
              orderBy: [{ inicio: 'asc' }, { id: 'asc' }],
            }),
            tx.predicciones.findMany({
              where: { parcelas: access, created_at: period },
              include: {
                parcelas: true,
                modelos_ia: true,
                evaluaciones_prediccion: {
                  where: { evaluated_at: { lte: cutoff } },
                  orderBy: [{ evaluated_at: 'desc' }, { id: 'asc' }],
                  take: 1,
                },
              },
              orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
            }),
          ]),
        { isolationLevel: 'RepeatableRead', timeout: 120000 },
      );
    const wanted = (code: string) =>
      /humedad_suelo|soil_moisture|caudal|flow|temperatura|temperature/i.test(
        code,
      );
    const selected = readings.filter((r) =>
      wanted(r.sensores.tipos_sensor.codigo),
    );
    const invalid = (r: (typeof readings)[number]) =>
      meta(r.metadata).valid === false ||
      (r.calidad != null && Number(r.calidad) <= 0) ||
      (r.sensores.valor_minimo != null &&
        Number(r.valor) < Number(r.sensores.valor_minimo)) ||
      (r.sensores.valor_maximo != null &&
        Number(r.valor) > Number(r.sensores.valor_maximo));
    const tables: AutomaticTable[] = [
      {
        id: '1',
        title: 'Registro de lecturas de sensores',
        description: 'Humedad del suelo, caudal y temperatura.',
        columns: columns([
          ['fecha', 'Fecha registrada (Lima)'],
          ['parcela', 'Parcela'],
          ['sensor', 'Sensor / código'],
          ['tipo', 'Tipo'],
          ['valor', 'Valor'],
          ['unidad', 'Unidad'],
          ['estado', 'Estado'],
        ]),
        rows: selected.map((r) => ({
          fecha: r.recorded_at.toISOString(),
          parcela: r.sensores.dispositivos.parcelas.nombre,
          sensor: r.sensores.codigo || r.sensor_id,
          tipo: r.sensores.tipos_sensor.nombre,
          valor: number(r.valor),
          unidad: r.sensores.tipos_sensor.unidad,
          estado: invalid(r)
            ? 'Inválida / fuera de rango'
            : 'Sin incidencia detectada',
        })),
        notes: [
          'Fecha registrada: recorded_at; en equipos sin reloj puede corresponder al registro del servidor.',
        ],
      },
      {
        id: '2',
        title: 'Control de adquisición y calidad de datos',
        description: 'Lecturas recibidas, válidas, faltantes e incidencias.',
        columns: columns([
          ['parcela', 'Parcela'],
          ['sensor', 'Sensor / código'],
          ['recibidas', 'Recibidas'],
          ['validas', 'Sin incidencia detectada'],
          ['invalidas', 'Inválidas / fuera de rango'],
          ['faltantes', 'Faltantes'],
        ]),
        rows: sensors
          .filter((s) => wanted(s.tipos_sensor.codigo))
          .map((s) => {
            const rows = selected.filter((r) => r.sensor_id === s.id);
            const bad = rows.filter(invalid).length;
            return {
              parcela: s.dispositivos.parcelas.nombre,
              sensor: s.codigo || s.id,
              recibidas: rows.length,
              validas: rows.length - bad,
              invalidas: bad,
              faltantes: null,
            };
          }),
        notes: [
          'Se cuentan registros recibidos. Sin una programación histórica verificada no se puede determinar cuántas lecturas faltan. La calidad se verifica con las marcas de origen y los límites registrados; no acredita calibración.',
        ],
      },
      {
        id: '3',
        title: 'Registro de eventos de riego',
        description: 'Fechas, duración, caudal y volumen de riego.',
        columns: columns([
          ['parcela', 'Parcela'],
          ['inicio', 'Inicio (Lima)'],
          ['fin', 'Fin (Lima)'],
          ['duracion', 'Duración (min)'],
          ['caudal', 'Caudal (L/min)'],
          ['volumen', 'Volumen (L)'],
          ['estado', 'Estado'],
        ]),
        rows: irrigations.map((r) => ({
          parcela: r.parcelas.nombre,
          inicio: r.inicio.toISOString(),
          fin: r.fin?.toISOString() || null,
          duracion: r.duracion_minutos,
          caudal: number(r.caudal_promedio_lmin),
          volumen: number(r.volumen_litros),
          estado: r.estado,
        })),
        notes: [
          'Se incluyen los eventos cuyo inicio está dentro del periodo y sus valores registrados.',
        ],
      },
      {
        id: '4',
        title: 'Registro de predicciones y evaluación del modelo',
        description: 'Humedad observada y predicha; MAE, RMSE y R².',
        columns: columns([
          ['fecha', 'Emisión (Lima)'],
          ['parcela', 'Parcela'],
          ['modelo', 'Modelo'],
          ['predicha', 'Predicha (%)'],
          ['observada', 'Observada (%)'],
          ['error', 'Error absoluto (pp)'],
          ['estado', 'Evaluación'],
        ]),
        rows: predictions.map((p) => {
          const e = p.evaluaciones_prediccion[0];
          const simulated = meta(p.output_data).simulado === true;
          const predicted = number(e?.humedad_predicha ?? p.humedad_predicha);
          const observed = number(e?.humedad_observada);
          return {
            fecha: p.created_at.toISOString(),
            parcela: p.parcelas.nombre,
            modelo: p.modelos_ia?.nombre || null,
            grupoModelo: `${p.modelo_id || 'sin-modelo'} / ${String(meta(p.output_data).modelo_version || 'versión histórica no registrada')}`,
            predicha: predicted,
            observada: observed,
            error:
              !simulated && predicted != null && observed != null
                ? Math.abs(predicted - observed)
                : null,
            estado: simulated
              ? 'Simulada; excluida de métricas'
              : observed == null || predicted == null
                ? 'Sin evaluación disponible'
                : 'Evaluación registrada',
          };
        }),
        notes: [
          'Se utiliza la última evaluación registrada de cada predicción; la humedad de entrada no se considera una observación futura.',
        ],
      },
      {
        id: '5',
        title: 'Identificación y calibración de sensores',
        description:
          'Características, códigos, rangos y calibración de humedad, caudal y temperatura.',
        columns: columns([
          ['parcela', 'Parcela'],
          ['tipo', 'Tipo'],
          ['codigo', 'Código'],
          ['modelo', 'Modelo'],
          ['unidad', 'Unidad'],
          ['minimo', 'Mínimo'],
          ['maximo', 'Máximo'],
          ['offset', 'Offset registrado'],
          ['calibracion', 'Fecha de calibración'],
        ]),
        rows: sensors
          .filter((s) => wanted(s.tipos_sensor.codigo))
          .map((s) => ({
            parcela: s.dispositivos.parcelas.nombre,
            tipo: s.tipos_sensor.nombre,
            codigo: s.codigo,
            modelo: s.modelo,
            unidad: s.tipos_sensor.unidad,
            minimo: number(s.valor_minimo),
            maximo: number(s.valor_maximo),
            offset: number(s.offset_calibracion),
            calibracion:
              s.fecha_calibracion?.toISOString().slice(0, 10) || null,
          })),
        notes: [
          'Catálogo actual de sensores; el filtro de fechas se aplica a los registros de las fichas 1 a 4. Un offset de cero no acredita calibración.',
        ],
      },
    ];
    const evaluation = tables[3];
    const groups = new Map<string, Row[]>();
    for (const row of evaluation.rows)
      if (row.error != null) {
        const key = `${row.modelo || 'Sin modelo identificado'} (${row.grupoModelo})`;
        const pairs = groups.get(key) || [];
        pairs.push(row);
        groups.set(key, pairs);
      }
    if (!groups.size)
      evaluation.notes.push(
        'MAE: Sin datos. RMSE: Sin datos. R²: No calculable; faltan pares evaluados.',
      );
    for (const [model, pairs] of groups) {
      const n = pairs.length,
        mean = pairs.reduce((a, r) => a + Number(r.observada), 0) / n;
      const sse = pairs.reduce((a, r) => a + Number(r.error) ** 2, 0),
        sst = pairs.reduce((a, r) => a + (Number(r.observada) - mean) ** 2, 0);
      evaluation.notes.push(
        `${model}: ${n} pares; MAE = ${(pairs.reduce((a, r) => a + Number(r.error), 0) / n).toFixed(4)} pp; RMSE = ${Math.sqrt(sse / n).toFixed(4)} pp; R² = ${n > 1 && sst > 0 ? (1 - sse / sst).toFixed(4) : 'No calculable'}. Métricas operativas de evaluaciones registradas.`,
      );
    }
    const snapshot: Snapshot = {
      schema: 1,
      id: 'automaticas',
      code: 'Fichas-IoT',
      cutoff: cutoff.toISOString(),
      timezone: 'America/Lima',
      general: {
        Periodo:
          start || query.hasta
            ? `${query.desde || 'Inicio del historial'} / ${end.toISOString()}`
            : 'Todo el historial',
      },
      filters: {},
      warnings: [],
      schedule: [],
      a: [],
      b: [],
      c: [],
      counts: { a: 0, b: 0, duplicates: 0, unassociated: 0 },
    };
    return {
      snapshot,
      tables: query.ficha ? tables.filter((t) => t.id === query.ficha) : tables,
    };
  }
}
