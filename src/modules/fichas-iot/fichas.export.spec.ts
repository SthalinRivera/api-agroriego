import { describe, it, expect } from '@jest/globals';
import { PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
import { writeExcel, writePdf } from './fichas.export';
import { sampleSnapshot } from '../../../test/fixtures/ficha';
async function collect(write: (stream: PassThrough) => Promise<void>) {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  await write(stream);
  return Buffer.concat(chunks);
}
describe('Ficha IoT: exportaciones completas', () => {
  it('exports all rows, exact backend numbers, Lima dates, frozen headers and safe text', async () => {
    const snapshot = sampleSnapshot();
    const buffer = await collect((stream) => writeExcel(snapshot, stream));
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(buffer as any);
    expect(book.worksheets.map((s) => s.name)).toEqual([
      'Datos generales',
      'A Datos IoT',
      'B Predicciones',
      'C Indicadores',
      'Diccionario de campos',
    ]);
    const a = book.getWorksheet('A Datos IoT')!;
    const b = book.getWorksheet('B Predicciones')!;
    expect(a.rowCount).toBe(81);
    expect(b.rowCount).toBe(46);
    expect(a.getCell('F2').value).toBe(0);
    expect(a.getCell('F3').value).toBe(31.123456);
    expect(a.getCell('C2').value).toEqual(new Date('2026-01-01T00:00:00.000Z'));
    expect(b.getCell('L2').value).toBe('No calculable');
    expect(a.views[0].state).toBe('frozen');
    const general = book.getWorksheet('Datos generales')!;
    let formulaTextFound = false;
    general.eachRow((row) => {
      if (row.getCell(2).value === snapshot.general.Responsable) {
        formulaTextFound = true;
        expect(row.getCell(2).type).toBe(ExcelJS.ValueType.String);
      }
    });
    expect(formulaTextFound).toBe(true);
    expect(book.getWorksheet('C Indicadores')!.getCell('C2').value).toBe(
      snapshot.c[0].value,
    );
    expect(book.getWorksheet('C Indicadores')!.getCell('C3').value).toBe(
      'No calculable',
    );
  });
  it('generates a multipage PDF including large A/B tables', async () => {
    const buffer = await collect((stream) =>
      writePdf(sampleSnapshot(), stream),
    );
    expect(buffer.subarray(0, 5).toString()).toBe('%PDF-');
    const pages = buffer.toString('latin1').match(/\/Type \/Page\b/g) || [];
    expect(pages.length).toBeGreaterThan(5);
  });
});
