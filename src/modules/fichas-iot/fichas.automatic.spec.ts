import { AutomaticFichasService } from './fichas.automatic';
import { PrismaService } from '../../config/prisma/prisma.service';
import { parcelaAccess } from '../../common/shared/parcela-access';
import { writeExcel, writePdf } from './fichas.export';
import { PassThrough } from 'node:stream';
import ExcelJS from 'exceljs';
async function bytes(write: (s: PassThrough) => Promise<void>) {
  const stream = new PassThrough(),
    chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  await write(stream);
  return Buffer.concat(chunks);
}
function setup() {
  const tx = {
    sensores: { findMany: jest.fn().mockResolvedValue([]) },
    lecturas: { findMany: jest.fn().mockResolvedValue([]) },
    riegos: { findMany: jest.fn().mockResolvedValue([]) },
    predicciones: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
  return {
    tx,
    service: new AutomaticFichasService(prisma as unknown as PrismaService),
  };
}
describe('Fichas automáticas', () => {
  it('prepares five downloadable empty fichas without any input', async () => {
    const { service, tx } = setup();
    const { snapshot, tables } = await service.collect('owner', {});
    expect(tables).toHaveLength(5);
    expect(tables.every((t) => t.columns.length && !t.rows.length)).toBe(true);
    expect(snapshot.general.Periodo).toBe('Todo el historial');
    expect(
      tx.lecturas.findMany.mock.calls[0][0].where.recorded_at.gte,
    ).toBeUndefined();
    expect(
      tx.lecturas.findMany.mock.calls[0][0].where.sensores.dispositivos
        .parcelas,
    ).toEqual(parcelaAccess('owner'));
    expect(tx.riegos.findMany.mock.calls[0][0].where.parcelas).toEqual(
      parcelaAccess('owner'),
    );
    expect(tx.predicciones.findMany.mock.calls[0][0].where.parcelas).toEqual(
      parcelaAccess('owner'),
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(
      (await bytes((s) => writeExcel(snapshot, s, tables))) as never,
    );
    expect(book.worksheets.map((s) => s.name)).toEqual([
      'Ficha 1',
      'Ficha 2',
      'Ficha 3',
      'Ficha 4',
      'Ficha 5',
      'Información',
    ]);
    expect(book.getWorksheet('Ficha 1')!.getCell('A2').value).toBe(
      'Sin datos disponibles',
    );
    const pdf = await bytes((s) => writePdf(snapshot, s, tables));
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type \/Page\b/g)?.length).toBe(10);
  });
  it('exports every irrigation row, preserves zeros, and supports optional dates and a single ficha', async () => {
    const { service, tx } = setup();
    tx.riegos.findMany.mockResolvedValue(
      Array.from({ length: 42 }, (_, i) => ({
        parcelas: { nombre: 'Campo' },
        inicio: new Date('2025-01-01T05:00:00Z'),
        fin: null,
        duracion_minutos: i,
        caudal_promedio_lmin: 0,
        volumen_litros: 0,
        estado: 'finalizado',
      })),
    );
    const { snapshot, tables } = await service.collect('owner', {
      ficha: '3',
      desde: '2024-01-01T05:00:00Z',
      hasta: '2025-12-31T05:00:00Z',
    });
    expect(tables).toHaveLength(1);
    expect(tables[0].rows).toHaveLength(42);
    expect(tx.riegos.findMany.mock.calls[0][0].where.inicio.gte).toEqual(
      new Date('2024-01-01T05:00:00Z'),
    );
    const book = new ExcelJS.Workbook();
    await book.xlsx.load(
      (await bytes((s) => writeExcel(snapshot, s, tables))) as never,
    );
    expect(book.getWorksheet('Ficha 3')!.rowCount).toBe(43);
    expect(book.getWorksheet('Ficha 3')!.getCell('E2').value).toBe(0);
  });
  it('rejects reversed dates', async () => {
    await expect(
      setup().service.collect('owner', {
        desde: '2025-02-01T00:00:00Z',
        hasta: '2025-01-01T00:00:00Z',
      }),
    ).rejects.toThrow('Revisa el rango');
  });
  it('does not substitute input moisture for future observation and excludes simulated pairs', async () => {
    const { service, tx } = setup();
    const base = {
      parcelas: { nombre: 'Campo' },
      modelos_ia: { nombre: 'Modelo' },
      created_at: new Date('2025-01-01'),
      humedad_suelo: 80,
      humedad_predicha: 30,
      output_data: {},
      evaluaciones_prediccion: [],
    };
    tx.predicciones.findMany.mockResolvedValue([
      base,
      {
        ...base,
        output_data: { simulado: true },
        evaluaciones_prediccion: [
          { humedad_observada: 50, humedad_predicha: 30 },
        ],
      },
    ]);
    const { tables } = await service.collect('owner', {});
    expect(tables[3].rows[0].observada).toBeNull();
    expect(tables[3].rows[1].error).toBeNull();
    expect(tables[3].notes.join(' ')).toContain('MAE: Sin datos');
  });
  it('calculates MAE, RMSE and R2 from recorded pairs and separates model identities', async () => {
    const { service, tx } = setup();
    const base = {
      parcela_id: 'field',
      modelo_id: 'model-a',
      parcelas: { nombre: 'Campo' },
      modelos_ia: { nombre: 'Modelo' },
      created_at: new Date('2025-01-01'),
      output_data: { modelo_version: '1' },
      humedad_predicha: 0,
    };
    tx.predicciones.findMany.mockResolvedValue([
      {
        ...base,
        evaluaciones_prediccion: [
          { humedad_observada: 10, humedad_predicha: 12 },
        ],
      },
      {
        ...base,
        evaluaciones_prediccion: [
          { humedad_observada: 20, humedad_predicha: 18 },
        ],
      },
      {
        ...base,
        modelo_id: 'model-b',
        evaluaciones_prediccion: [
          { humedad_observada: 10, humedad_predicha: 10 },
        ],
      },
    ]);
    const { tables } = await service.collect('owner', {});
    expect(tables[3].notes.join(' ')).toContain(
      '2 pares; MAE = 2.0000 pp; RMSE = 2.0000 pp; R² = 0.8400',
    );
    expect(tables[3].notes.join(' ')).toContain(
      '1 pares; MAE = 0.0000 pp; RMSE = 0.0000 pp; R² = No calculable',
    );
  });
});
