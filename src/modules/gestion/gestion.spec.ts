import { ForbiddenException } from '@nestjs/common';
import { GestionController } from './gestion.module';

describe('GestionController access boundaries', () => {
  const req = { user: { id: 'current-user' } };
  const delegate = () => ({ findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) });
  let prisma: any;
  let controller: GestionController;
  beforeEach(() => {
    prisma = { device_logs: delegate(), evaluaciones_prediccion: delegate(), parcela_usuarios: delegate(), auditoria: delegate(), user_devices: { ...delegate(), updateMany: jest.fn() }, profiles: { findUnique: jest.fn(), update: jest.fn() } };
    controller = new GestionController(prisma);
  });
  it('restricts events to accessible parcels even with a supplied device id', async () => {
    await controller.eventos({ page: 2, limit: 10, dispositivoId: 'foreign-device' }, req);
    const args = prisma.device_logs.findMany.mock.calls[0][0];
    expect(args.skip).toBe(10);
    expect(args.where.dispositivo_id).toBe('foreign-device');
    expect(args.where.dispositivos.parcelas.OR).toEqual([{ propietario_id: 'current-user' }, { parcela_usuarios: { some: { usuario_id: 'current-user' } } }]);
  });
  it('does not expose push tokens or another user devices', async () => {
    await controller.dispositivosPush({ page: 1, limit: 20 }, req);
    const args = prisma.user_devices.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ usuario_id: 'current-user' });
    expect(args.select.fcm_token).toBeUndefined();
    controller.desactivarPush('device-id', req);
    expect(prisma.user_devices.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'device-id', usuario_id: 'current-user' } }));
  });
  it('rejects modifying or reading another profile', () => {
    expect(() => controller.actualizarPerfil('other-user', { fullName: 'Changed' }, req)).toThrow(ForbiddenException);
    expect(() => controller.perfilPorId('other-user', req)).toThrow(ForbiddenException);
    expect(prisma.profiles.update).not.toHaveBeenCalled();
  });
  it('only returns own audit records and excludes sensitive payloads', async () => {
    await controller.auditoria({ page: 1, limit: 20 }, req);
    const args = prisma.auditoria.findMany.mock.calls[0][0];
    expect(args.where).toEqual({ usuario_id: 'current-user' });
    expect(args.select.datos_anteriores).toBeUndefined();
    expect(args.select.datos_nuevos).toBeUndefined();
  });
});

describe('Administrative access', () => {
  it('blocks non-admin accounts before listing users or system settings', async () => {
    const prisma: any = { profiles: { findUnique: jest.fn().mockResolvedValue({ activo: true, roles: { codigo: 'agricultor' } }), findMany: jest.fn() }, configuracion_sistema: { findMany: jest.fn() } };
    const controller = new GestionController(prisma);
    await expect(controller.usuarios({ page: 1, limit: 20 }, { user: { id: 'user' } })).rejects.toThrow(ForbiddenException);
    await expect(controller.sistema({ user: { id: 'user' } })).rejects.toThrow(ForbiddenException);
    expect(prisma.profiles.findMany).not.toHaveBeenCalled();
    expect(prisma.configuracion_sistema.findMany).not.toHaveBeenCalled();
  });
  it('prevents administrators from deactivating or changing their own role', async () => {
    const prisma: any = { profiles: { findUnique: jest.fn().mockResolvedValue({ activo: true, roles: { codigo: 'admin' } }), update: jest.fn() } };
    const controller = new GestionController(prisma);
    await expect(controller.actualizarUsuario('admin-id', { activo: false }, { user: { id: 'admin-id' } })).rejects.toThrow(ForbiddenException);
    expect(prisma.profiles.update).not.toHaveBeenCalled();
  });
});
