export type Cell = string | number | null;
export type Row = Record<string, Cell>;
export interface Reading {
  id: string;
  sensorId: string;
  at: string | null;
  receivedAt: string;
  value: number | null;
  messageId?: string;
  note?: string;
}
export interface Schedule {
  desde: string;
  intervaloMinutos: number;
}
export interface Forecast {
  id: string;
  issuedAt: string;
  model: string;
  version: string | null;
  horizon: 24 | 48;
  value: number;
  evaluationSet?: string;
}
export interface Metric {
  group: string;
  label: string;
  value: number | string | null;
  unit: string;
  status: 'Disponible' | 'Sin dato' | 'No calculable';
  reason: string;
}
export interface Snapshot {
  schema: 1;
  id: string;
  code: string;
  cutoff: string;
  timezone: 'America/Lima';
  general: Row;
  filters: Row;
  warnings: string[];
  schedule: Schedule[];
  a: Row[];
  b: Row[];
  c: Metric[];
  counts: { a: number; b: number; duplicates: number; unassociated: number };
}
export interface Column {
  key: string;
  label: string;
  kind?: 'date' | 'number';
  width?: number;
}
export const aColumns: Column[] = [
  { key: 'numero', label: 'N°', kind: 'number' },
  { key: 'programada', label: 'Fecha programada', kind: 'date' },
  { key: 'medicion', label: 'Fecha de medición', kind: 'date' },
  { key: 'recibida', label: 'Recepción / registro', kind: 'date' },
  { key: 'recibido', label: 'Dato recibido (1/0)', kind: 'number' },
  { key: 'humedad', label: 'Humedad suelo (%)', kind: 'number' },
  { key: 'temperatura', label: 'Temperatura (°C)', kind: 'number' },
  { key: 'humedadRelativa', label: 'Humedad relativa (%)', kind: 'number' },
  { key: 'ultimoRiego', label: 'Último riego', kind: 'date' },
  { key: 'observaciones', label: 'Observaciones' },
];
export const bColumns: Column[] = [
  { key: 'codigo', label: 'Predicción' },
  { key: 'emision', label: 'Emisión', kind: 'date' },
  { key: 'modelo', label: 'Modelo' },
  { key: 'version', label: 'Versión' },
  { key: 'horizonte', label: 'Horizonte (h)', kind: 'number' },
  { key: 'objetivo', label: 'Fecha objetivo', kind: 'date' },
  { key: 'predicha', label: 'Predicha (%)', kind: 'number' },
  { key: 'observada', label: 'Observada (%)', kind: 'number' },
  { key: 'observacion', label: 'Observación utilizada', kind: 'date' },
  { key: 'desfase', label: 'Desfase (min)', kind: 'number' },
  { key: 'ea', label: 'EA (pp)', kind: 'number' },
  { key: 'epa', label: 'EPA (%)', kind: 'number' },
  { key: 'estado', label: 'Estado' },
  { key: 'motivo', label: 'Motivo / conjunto' },
];
export const TITLE =
  'Ficha de registro de datos IoT y predicción de la disponibilidad hídrica del suelo';
export const LEGEND = [
  'Fechas en America/Lima (UTC-05:00); periodo cerrado [inicio, fin]. Corte: instante de generación de la instantánea.',
  'pp = puntos porcentuales. EA = |observada - predicha|. EPA = EA / observada × 100; con observada=0 no es calculable.',
  'Disponibilidad = recibidos únicos asociados / esperados × 100. Pérdida = (esperados - recibidos únicos asociados) / esperados × 100.',
  'Intervalo medio: promedio de diferencias entre mediciones válidas consecutivas. Variación = final - inicial (pp). Tasa = (inicial - final) / días entre mediciones.',
  'MAE = promedio(EA). RMSE = raíz(promedio(error²)). R² = 1 - SSE/SST; requiere al menos 2 pares y observaciones no constantes.',
  'Verificación: lectura válida más próxima al objetivo dentro de la tolerancia; empate: fecha anterior y luego menor ID. Desfase = observación - objetivo.',
  'Duplicados: mismo sensor y mensaje, o misma fecha de medición; se conserva la primera recepción y luego el menor ID. Nunca se imputan valores.',
  'Asociación A: medición al horario más próximo dentro de media separación entre horarios y la tolerancia de adquisición; cada lectura y horario se usan una sola vez.',
  'Recepción / registro = created_at del servidor; no acredita la hora de llegada física del paquete. Los datos ESP32 antiguos sin reloj de medición no se tratan como mediciones fechadas.',
  'Sin dato = falta información de origen. No calculable = denominador cero, muestra insuficiente o programación incompleta. Los textos de Excel son celdas de texto, nunca fórmulas.',
];
