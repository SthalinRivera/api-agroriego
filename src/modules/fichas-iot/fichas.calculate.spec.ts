import { describe, it, expect } from '@jest/globals';
import { calculate, deduplicate } from './fichas.calculate';
import type { Forecast, Reading } from './fichas.types';
const at = (hours: number) =>
  new Date(Date.UTC(2026, 0, 1) + hours * 3600000).toISOString();
const reading = (id: string, hours: number, value: number): Reading => ({
  id,
  sensorId: 'soil',
  at: at(hours),
  receivedAt: at(hours + 0.01),
  value,
});
const forecast = (
  id: string,
  issued: number,
  horizon: 24 | 48,
  value = 20,
): Forecast => ({
  id,
  issuedAt: at(issued),
  model: 'Modelo original',
  version: 'v1',
  horizon,
  value,
});
function run(overrides: Partial<Parameters<typeof calculate>[0]> = {}) {
  return calculate({
    start: at(0),
    end: at(2),
    cutoff: at(100),
    readings: [],
    temperature: [],
    humidity: [],
    irrigations: [],
    forecasts: [],
    schedule: [{ desde: at(0), intervaloMinutos: 60 }],
    tolerance: 30,
    acquisitionTolerance: 10,
    ...overrides,
  });
}
const metric = (result: ReturnType<typeof run>, name: string, group?: string) =>
  result.c.find(
    (m) => m.label === name && (!group || m.group.startsWith(group)),
  );
describe('Ficha IoT: cálculos científicos sin imputación', () => {
  it('retains missing rows and null moisture for a period without data', () => {
    const r = run();
    expect(r.a).toHaveLength(3);
    expect(r.a.every((a) => a.recibido === 0 && a.humedad === null)).toBe(true);
    expect(metric(r, 'Disponibilidad')?.value).toBe(0);
    expect(metric(r, 'Humedad al cierre')?.value).toBeNull();
  });
  it('does not invent expected counts without a historical schedule', () => {
    const r = run({ schedule: [], readings: [reading('1', 1, 0)] });
    expect(metric(r, 'Registros esperados')?.value).toBeNull();
    expect(r.a[0].humedad).toBe(0);
    expect(r.a[0].programada).toBeNull();
  });
  it('deduplicates readings and counts each scheduled slot only once', () => {
    const r = run({
      readings: [
        reading('2', 0, 40),
        reading('1', 0, 30),
        reading('3', 0.05, 31),
        reading('4', 2, 20),
      ],
    });
    expect(r.counts.duplicates).toBe(1);
    expect(r.counts.unassociated).toBe(1);
    expect(metric(r, 'Recibidos únicos asociados')?.value).toBe(2);
    expect(r.a[0].humedad).toBe(30);
  });
  it('uses interval changes and anchors without restarting at period start', () => {
    const r = run({
      start: at(0.25),
      end: at(3),
      schedule: [
        { desde: at(0), intervaloMinutos: 30 },
        { desde: at(1), intervaloMinutos: 60 },
      ],
    });
    expect(r.a.map((x) => x.programada)).toEqual([
      at(0.5),
      at(1),
      at(2),
      at(3),
    ]);
  });
  it('marks partial schedule coverage as unavailable', () => {
    expect(
      metric(
        run({ schedule: [{ desde: at(1), intervaloMinutos: 30 }] }),
        'Disponibilidad',
      )?.value,
    ).toBeNull();
  });
  it('finds observations after the period and deterministically picks the earlier tie', () => {
    const r = run({
      forecasts: [forecast('p', 1, 24)],
      readings: [reading('1', 24.75, 30), reading('2', 25.25, 40)],
    });
    expect(r.b[0]).toMatchObject({
      observada: 30,
      ea: 10,
      desfase: -15,
      estado: 'Verificada',
    });
    expect(r.b[0].epa).toBeCloseTo(100 / 3);
  });
  it('does not evaluate predictions before the target, and marks absent observations', () => {
    const r = run({
      cutoff: at(25),
      forecasts: [forecast('pending', 2, 24), forecast('missing', 0, 24)],
    });
    expect(r.b.map((b) => b.estado)).toEqual([
      'Pendiente',
      'Sin observación válida',
    ]);
  });
  it('retains observed zero and leaves EPA non-calculable', () => {
    const r = run({
      forecasts: [forecast('p', 0, 24)],
      readings: [reading('1', 24, 0)],
    });
    expect(r.b[0]).toMatchObject({
      observada: 0,
      ea: 20,
      epa: null,
      estado: 'Verificada',
    });
  });
  it('computes horizons independently and never calculates R² for constant observations', () => {
    const r = run({
      forecasts: [
        forecast('p1', 0, 24, 8),
        forecast('p2', 1, 24, 12),
        forecast('p3', 0, 48, 20),
      ],
      readings: [
        reading('1', 24, 10),
        reading('2', 25, 10),
        reading('3', 48, 30),
      ],
    });
    expect(metric(r, 'MAE', '24 h')?.value).toBe(2);
    expect(metric(r, 'RMSE', '24 h')?.value).toBe(2);
    expect(metric(r, 'R²', '24 h')).toMatchObject({
      value: null,
      reason: 'Observaciones constantes',
    });
    expect(metric(r, 'MAE', '48 h')?.value).toBe(10);
    expect(metric(r, 'R²', '48 h')?.value).toBeNull();
  });
  it('computes R² and water variation with full precision and real elapsed days', () => {
    const r = run({
      forecasts: [forecast('p1', 0, 24, 11), forecast('p2', 1, 24, 19)],
      readings: [
        reading('1', 0, 33),
        reading('2', 2, 31),
        reading('3', 24, 10),
        reading('4', 25, 20),
      ],
      irrigations: [at(-24)],
    });
    expect(metric(r, 'R²', '24 h')?.value).toBe(0.96);
    expect(metric(r, 'Variación')?.value).toBe(-2);
    expect(metric(r, 'Tasa de disminución')?.value).toBe(24);
    expect(metric(r, 'Días desde último riego')?.value).toBeCloseTo(26 / 24);
  });
  it('does not use receipt-only timestamps to verify predictions or associate schedules', () => {
    const r = run({
      readings: [{ ...reading('1', 1, 30), at: null }],
      forecasts: [forecast('p', 0, 24)],
    });
    expect(metric(r, 'Humedad al cierre')?.value).toBeNull();
    expect(r.counts.unassociated).toBe(1);
  });
  it('rejects oversized schedules instead of silently truncating', () => {
    expect(() =>
      run({ end: at(48), schedule: [{ desde: at(0), intervaloMinutos: 0.1 }] }),
    ).toThrow('20 000');
  });
  it('deduplicates retransmitted message identifiers even if timestamp changed', () => {
    expect(
      deduplicate([
        { ...reading('1', 0, 10), messageId: 'packet' },
        { ...reading('2', 1, 10), messageId: 'packet' },
      ]),
    ).toHaveLength(1);
  });
});
