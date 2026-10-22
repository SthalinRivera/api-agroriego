import { PrismaService } from '../../config/prisma/prisma.service';
import { CultivosService } from '../../modules/cultivos/cultivos.service';
import { ParcelasService } from '../../modules/parcelas/parcelas.service';
import { RiegosService } from '../../modules/riegos/riegos.service';
import { ModelosIAService } from '../../modules/modelos-ia/modelos-ia.service';
describe('DTO to Prisma field mapping', () => {
  it('maps crop fields without passing camelCase DTO keys to Prisma', async () => {
    const create = jest.fn().mockResolvedValue({});
    const prisma = { parcelas: { findUnique: jest.fn().mockResolvedValue({ propietario_id: 'owner' }) }, cultivos: { create } };
    await new CultivosService(prisma as unknown as PrismaService).create({ parcelaId: 'parcela', cantidadPlantas: 20, sistemaRiego: 'Goteo', fechaSiembra: '2026-01-01' }, 'owner');
    const data = create.mock.calls[0][0].data;
    expect(data).toMatchObject({ parcela_id: 'parcela', cantidad_plantas: 20, sistema_riego: 'Goteo', fecha_siembra: new Date('2026-01-01') });
    expect(data).not.toHaveProperty('parcelaId');
    expect(data).not.toHaveProperty('cantidadPlantas');
  });
  it('maps parcel area and altitude', async () => {
    const create = jest.fn().mockResolvedValue({});
    await new ParcelasService({ parcelas: { create } } as unknown as PrismaService).create({ nombre: 'Campo', areaHectareas: 3, altitudMsnm: 100 }, 'owner');
    expect(create.mock.calls[0][0].data).toEqual({ nombre: 'Campo', area_hectareas: 3, altitud_msnm: 100, propietario_id: 'owner' });
  });
  it('maps irrigation update fields', async () => {
    const update = jest.fn().mockResolvedValue({});
    const service = new RiegosService({ riegos: { update } } as unknown as PrismaService);
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
    await service.update('riego', { duracionMinutos: 5, volumenLitros: 20 }, 'owner');
    expect(update.mock.calls[0][0].data).toMatchObject({ duracion_minutos: 5, volumen_litros: 20 });
    expect(update.mock.calls[0][0].data).not.toHaveProperty('volumenLitros');
  });
  it('maps the model file URL when updating', async () => {
    const update = jest.fn().mockResolvedValue({});
    const service = new ModelosIAService({ modelos_ia: { update } } as unknown as PrismaService);
    jest.spyOn(service, 'findOne').mockResolvedValue({} as never);
    await service.update('modelo', { archivoUrl: 'https://example.com/model' });
    expect(update.mock.calls[0][0].data).toEqual({ archivo_url: 'https://example.com/model' });
  });
});
