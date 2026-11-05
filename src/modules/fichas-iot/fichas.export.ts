import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import type { Writable } from 'node:stream';
import { finished } from 'node:stream/promises';
import {
  aColumns,
  bColumns,
  Cell,
  Column,
  LEGEND,
  Row,
  Snapshot,
  TITLE,
} from './fichas.types';
export const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es-PE', {
    timeZone: 'America/Lima',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(value));
const isDate = (v: Cell) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}T/.test(v) &&
  Number.isFinite(Date.parse(v));
export function display(value: Cell, key = '', row?: Row) {
  if (value === null || value === undefined || value === '')
    return key === 'epa' && row?.observada === 0 ? 'No calculable' : 'Sin dato';
  if (typeof value === 'number')
    return new Intl.NumberFormat('es-PE', { maximumFractionDigits: 4 }).format(
      value,
    );
  return isDate(value) ? formatDate(value) : value;
}
export function generalRows(s: Snapshot): Row[] {
  return Object.entries({
    Título: TITLE,
    'Código de ficha': s.code,
    'Fecha de generación / corte': s.cutoff,
    'Zona horaria': s.timezone,
    ...s.general,
    ...Object.fromEntries(
      Object.entries(s.filters).map(([k, v]) => [`Filtro: ${k}`, v]),
    ),
    'Filas A': s.counts.a,
    'Filas B': s.counts.b,
    'Duplicados excluidos': s.counts.duplicates,
    'Lecturas no asociadas': s.counts.unassociated,
    ...Object.fromEntries(
      s.schedule.map((p, i) => [
        `Programación ${i + 1}`,
        `Desde ${formatDate(p.desde)}: cada ${p.intervaloMinutos} minutos`,
      ]),
    ),
    ...Object.fromEntries(s.warnings.map((w, i) => [`Limitación ${i + 1}`, w])),
  }).map(([campo, valor]) => ({ campo, valor }));
}
export function indicatorRows(s: Snapshot): Row[] {
  return s.c.map((m) => ({
    grupo: m.group,
    indicador: m.label,
    valor: m.value,
    unidad: m.unit,
    estado: m.status,
    motivo: m.reason,
  }));
}
export const indicatorColumns: Column[] = [
  { key: 'grupo', label: 'Grupo' },
  { key: 'indicador', label: 'Indicador' },
  { key: 'valor', label: 'Valor' },
  { key: 'unidad', label: 'Unidad' },
  { key: 'estado', label: 'Estado' },
  { key: 'motivo', label: 'Motivo' },
];
export const dictionaryRows = (): Row[] => [
  ...aColumns.map((c) => ({ campo: `A.${c.key}`, descripcion: c.label })),
  ...bColumns.map((c) => ({ campo: `B.${c.key}`, descripcion: c.label })),
  ...LEGEND.map((descripcion, i) => ({ campo: `Regla ${i + 1}`, descripcion })),
];
export async function writeExcel(s: Snapshot, output: Writable) {
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({
    stream: output,
    useStyles: true,
    useSharedStrings: false,
  });
  workbook.creator = 'Agroriego';
  workbook.created = new Date(s.cutoff);
  const sheet = async (name: string, columns: Column[], rows: Row[]) => {
    const ws = workbook.addWorksheet(name, {
      views: [{ state: 'frozen', ySplit: 1 }],
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
      },
    });
    ws.columns = columns.map((c) => ({
      header: c.label,
      key: c.key,
      width:
        c.kind === 'date'
          ? 23
          : ['observaciones', 'motivo', 'descripcion', 'valor'].includes(c.key)
            ? 60
            : c.key === 'codigo'
              ? 40
              : 26,
    }));
    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: rows.length + 1, column: columns.length },
    };
    ws.getRow(1).font = { bold: true, color: { argb: 'FF000000' } };
    ws.getRow(1).height = 32;
    ws.getRow(1).alignment = { wrapText: true, vertical: 'middle' };
    ws.getRow(1).commit();
    for (const [index, row] of rows.entries()) {
      const excelRow = ws.addRow(
        columns.map((c) => {
          const v = row[c.key];
          if (isDate(v)) {
            // Excel has no timezone: encode Lima wall time as a date serial, explicitly labelled in the workbook.
            return new Date(new Date(String(v)).getTime() - 5 * 3600000);
          }
          if (v === null || v === undefined || v === '')
            return c.key === 'valor' && row.estado
              ? row.estado
              : c.key === 'epa' && row.observada === 0
                ? 'No calculable'
                : 'Sin dato';
          // Plain string values become XML string cells; never use ExcelJS formula/hyperlink objects for user text.
          return typeof v === 'number' ? v : String(v);
        }),
      );
      excelRow.alignment = { wrapText: true, vertical: 'top' };
      excelRow.eachCell((cell, i) => {
        const original = row[columns[i - 1].key];
        if (isDate(original)) cell.numFmt = 'dd/mm/yyyy hh:mm:ss';
        else if (typeof original === 'number') cell.numFmt = '0.0000';
      });
      excelRow.commit();
      if (index % 200 === 0)
        await new Promise<void>((resolve) => setImmediate(resolve));
    }
    ws.commit();
  };
  await sheet(
    'Datos generales',
    [
      { key: 'campo', label: 'Campo' },
      { key: 'valor', label: 'Valor' },
    ],
    generalRows(s),
  );
  await sheet('A Datos IoT', aColumns, s.a);
  await sheet('B Predicciones', bColumns, s.b);
  await sheet('C Indicadores', indicatorColumns, indicatorRows(s));
  await sheet(
    'Diccionario de campos',
    [
      { key: 'campo', label: 'Campo' },
      { key: 'descripcion', label: 'Descripción / regla' },
    ],
    dictionaryRows(),
  );
  await workbook.commit();
}
export async function writePdf(s: Snapshot, output: Writable) {
  const doc = new PDFDocument({
    autoFirstPage: false,
    compress: true,
    info: {
      Title: TITLE,
      Author: 'Agroriego',
      CreationDate: new Date(s.cutoff),
    },
  });
  const completion = finished(output);
  // A destination disconnect aborts production rather than retaining an unbounded buffer.
  output.on('error', () => doc.destroy());
  doc.on('error', (error) => output.destroy(error));
  doc.pipe(output);
  let page = 0;
  let y = 0;
  let title = '';
  let columns: Column[] = [];
  let widths: number[] = [];
  let fontSize = 9;
  const pageBottom = () => doc.page.height - 58;
  const addPage = (wide = false) => {
    doc.addPage({
      size: wide ? 'A3' : 'A4',
      layout: wide ? 'landscape' : 'portrait',
      margins: { top: 38, left: 38, right: 38, bottom: 38 },
    });
    page++;
    doc
      .fillColor('black')
      .font('Helvetica-Bold')
      .fontSize(11)
      .text(
        `Anexo ${s.general.Anexo || 'sin número'} · Ficha de registro IoT`,
        38,
        28,
        { width: doc.page.width - 76 },
      );
    doc
      .font('Helvetica')
      .fontSize(7)
      .text(
        `${s.code} · Corte ${formatDate(s.cutoff)} · America/Lima`,
        38,
        44,
        { width: doc.page.width - 76 },
      );
    doc.text(`Página ${page}`, 38, doc.page.height - 50, {
      width: doc.page.width - 76,
      align: 'right',
      lineBreak: false,
    });
    y = 68;
  };
  const drawRow = (values: string[], bold: boolean) => {
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(fontSize);
    const height =
      Math.max(
        ...values.map((v, i) =>
          doc.heightOfString(v, { width: widths[i] - 10, lineGap: 2 }),
        ),
      ) + 12;
    let x = 38;
    values.forEach((value, i) => {
      doc
        .lineWidth(0.4)
        .strokeColor('black')
        .rect(x, y, widths[i], height)
        .stroke();
      doc.text(value, x + 5, y + 5, { width: widths[i] - 10, lineGap: 2 });
      x += widths[i];
    });
    y += height;
    return height;
  };
  const header = () => {
    doc
      .font('Helvetica-Bold')
      .fontSize(12)
      .text(title, 38, y, { width: doc.page.width - 76 });
    y += doc.heightOfString(title, { width: doc.page.width - 76 }) + 12;
    drawRow(
      columns.map((c) => c.label),
      true,
    );
  };
  const table = async (
    heading: string,
    cols: Column[],
    rows: Row[],
    wide = false,
  ) => {
    title = heading;
    columns = cols;
    fontSize = wide ? 8 : 9;
    addPage(wide);
    const available = doc.page.width - 76;
    const weights = columns.map((c) =>
      c.key === 'numero' || c.key === 'recibido'
        ? 0.55
        : ['observaciones', 'motivo', 'descripcion', 'valor'].includes(c.key)
          ? 2.4
          : 1,
    );
    const total = weights.reduce((a, b) => a + b, 0);
    widths = weights.map((w) => (available * w) / total);
    header();
    if (!rows.length) {
      doc
        .font('Helvetica')
        .fontSize(10)
        .text('Sin registros para los filtros seleccionados.', 38, y + 15);
      return;
    }
    for (const [index, row] of rows.entries()) {
      const values = columns.map((c) =>
        c.key === 'valor' && row[c.key] === null && row.estado
          ? String(row.estado)
          : display(row[c.key], c.key, row),
      );
      doc.font('Helvetica').fontSize(fontSize);
      const height =
        Math.max(
          ...values.map((v, i) =>
            doc.heightOfString(v, { width: widths[i] - 10, lineGap: 2 }),
          ),
        ) + 12;
      if (y + height > pageBottom()) {
        addPage(wide);
        header();
      }
      if (height > pageBottom() - y)
        throw new Error(
          'Una fila supera la altura imprimible. Acorta el texto del campo antes de exportar.',
        );
      drawRow(values, false);
      if (index % 100 === 0) {
        if (output.destroyed) throw new Error('Descarga cancelada');
        await new Promise<void>((resolve) => setImmediate(resolve));
      }
    }
  };
  try {
    await table(
      TITLE,
      [
        { key: 'campo', label: 'Datos generales y trazabilidad' },
        { key: 'valor', label: 'Valor' },
      ],
      generalRows(s),
    );
    await table('A. Adquisición y datos IoT', aColumns, s.a, true);
    await table('B. Predicciones y verificación', bColumns, s.b, true);
    await table(
      'C. Resumen de indicadores',
      indicatorColumns,
      indicatorRows(s),
      true,
    );
    await table(
      'Diccionario, unidades y fórmulas',
      [
        { key: 'campo', label: 'Campo' },
        { key: 'descripcion', label: 'Descripción / regla' },
      ],
      dictionaryRows(),
    );
    doc.end();
    await completion;
  } catch (error) {
    doc.destroy();
    output.destroy(error as Error);
    await completion.catch(() => {});
    throw error;
  }
}
