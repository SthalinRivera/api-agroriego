import { PrismaService } from '../../config/prisma/prisma.service';
import { parcelaAccess } from './parcela-access';
import { AlertasService } from '../../modules/alertas/alertas.service';
import { CultivosService } from '../../modules/cultivos/cultivos.service';
import { PrediccionesService } from '../../modules/predicciones/predicciones.service';
import { ReportesService } from '../../modules/reportes/reportes.service';
import { RiegosService } from '../../modules/riegos/riegos.service';
import { DispositivosService } from '../../modules/dispositivos/dispositivos.service';
import { SensoresService } from '../../modules/sensores/sensores.service';
import { LecturasService } from '../../modules/lecturas/lecturas.service';
import { ParcelasService } from '../../modules/parcelas/parcelas.service';

describe('Dashboard query authorization', () => {
  const user = 'current-user';
  const delegate = () => ({ findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) });
  it.each([
    ['alertas', AlertasService], ['cultivos', CultivosService],
    ['predicciones', PrediccionesService], ['reportes', ReportesService], ['riegos', RiegosService],
  ] as const)('%s intersects a supplied parcelaId with user access', async (model, Service) => {
    const table = delegate();
    const service = new Service({ [model]: table } as unknown as PrismaService);
    await service.findAll({ parcelaId: 'foreign-parcela', page: 2, limit: 10 }, user);
    const expected = { parcelas: parcelaAccess(user), parcela_id: 'foreign-parcela' };
    expect(table.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expected, skip: 10, take: 10 }));
    expect(table.count).toHaveBeenCalledWith({ where: expected });
  });
  it('includes owners and assigned users without search overriding access', async () => {
    const table = delegate();
    await new ParcelasService({ parcelas: table } as unknown as PrismaService).findAll({ search: 'campo' }, user);
    const where = table.findMany.mock.calls[0][0].where;
    expect(where.AND).toEqual([parcelaAccess(user)]);
    expect(where.OR).toHaveLength(2);
    expect(parcelaAccess(user).OR).toEqual([
      { propietario_id: user }, { parcela_usuarios: { some: { usuario_id: user } } },
    ]);
  });
  it('includes devices in owned and assigned parcelas', async () => {
    const table = delegate();
    await new DispositivosService({ dispositivos: table } as unknown as PrismaService).findAll({}, user);
    expect(table.findMany.mock.calls[0][0].where).toEqual({ parcelas: parcelaAccess(user) });
  });
  it('never replaces sensor access with a requested device', async () => {
    const table = delegate();
    await new SensoresService({ sensores: table } as unknown as PrismaService).findAll({ dispositivoId: 'foreign-device' }, user);
    expect(table.findMany.mock.calls[0][0].where).toEqual({
      dispositivos: { parcelas: parcelaAccess(user) }, dispositivo_id: 'foreign-device',
    });
  });
  it('combines every reading filter with ownership instead of bypassing access', async () => {
    const table = delegate();
    await new LecturasService({ lecturas: table } as unknown as PrismaService).findAll({
      sensorId: 'foreign-sensor', dispositivoId: 'foreign-device', tipoSensorId: 3,
      tipoSensorCodigo: 'humedad_suelo',
    }, user);
    expect(table.findMany.mock.calls[0][0].where).toEqual({
      sensor_id: 'foreign-sensor',
      sensores: { dispositivos: { parcelas: parcelaAccess(user) }, dispositivo_id: 'foreign-device',
        tipo_sensor_id: 3n, tipos_sensor: { codigo: 'humedad_suelo' } },
    });
  });
  it('latest readings retain ownership when no parcela is selected', async () => {
    const table = delegate();
    await new LecturasService({ lecturas: table } as unknown as PrismaService).findLatest({}, user);
    expect(table.findMany.mock.calls[0][0].where).toEqual({
      sensores: { activo: true, dispositivos: { parcelas: parcelaAccess(user) } },
    });
  });
  it('a collaborator cannot delete the owner parcela', async () => {
    const service = new ParcelasService({} as PrismaService);
    jest.spyOn(service, 'findOne').mockResolvedValue({ propietario_id: 'owner' } as never);
    await expect(service.delete('parcela', user)).rejects.toThrow('Solo el propietario');
  });
  it('heartbeat verifies access before writing status', async () => {
    const update = jest.fn();
    const service = new DispositivosService({ dispositivos: {
      findUnique: jest.fn().mockResolvedValue({ id: 'foreign-device' }), update,
    } } as unknown as PrismaService);
    jest.spyOn(service, 'findOne').mockRejectedValue(new Error('Forbidden'));
    await expect(service.heartbeat({ deviceUid: 'foreign-uid' }, user)).rejects.toThrow('Forbidden');
    expect(update).not.toHaveBeenCalled();
  });
});
