import { NotificationTestService } from './notification-test.service';
function setup() {
  const notification = { id: 'n', usuario_id: 'u', titulo: 'Test', mensaje: 'Test' };
  const tx = {
    $executeRaw: jest.fn(),
    notificaciones: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue(notification) },
    user_devices: { findMany: jest.fn().mockResolvedValue([{ id: 'd', fcm_token: 'token' }]) },
  };
  const prisma: any = {
    $transaction: (fn: any) => fn(tx),
    user_devices: { updateMany: jest.fn() }, notificaciones: { update: jest.fn() },
  };
  const fcm: any = { enabled: true, send: jest.fn().mockResolvedValue('sent') };
  return { service: new NotificationTestService(prisma, fcm), tx, prisma, fcm };
}
describe('notification test endpoint service', () => {
  it('uses only the authenticated user devices and persists the outcome', async () => {
    const f = setup();
    expect(await f.service.send('u')).toMatchObject({ sent: 1, failed: 0 });
    expect(f.tx.user_devices.findMany).toHaveBeenCalledWith({ where: { usuario_id: 'u', activo: true } });
    expect(f.tx.notificaciones.create.mock.calls[0][0].data).toMatchObject({ usuario_id: 'u', tipo: 'prueba_push' });
    expect(f.prisma.notificaciones.update.mock.calls[0][0].data.data.push.status).toBe('test_sent');
    expect(f.fcm.send).toHaveBeenCalledTimes(1);
  });
  it('rejects users without registered devices before creating history', async () => {
    const f = setup(); f.tx.user_devices.findMany.mockResolvedValue([]);
    await expect(f.service.send('u')).rejects.toThrow('No tienes dispositivos registrados');
    expect(f.tx.notificaciones.create).not.toHaveBeenCalled();
  });
  it('limits repeated tests across instances using persisted history', async () => {
    const f = setup(); f.tx.notificaciones.findFirst.mockResolvedValue({ id: 'recent' });
    await expect(f.service.send('u')).rejects.toThrow('Espera 30 segundos');
    expect(f.fcm.send).not.toHaveBeenCalled();
  });
  it('does not report success when Firebase fails', async () => {
    const f = setup(); f.fcm.send.mockRejectedValue(new Error('unavailable'));
    await expect(f.service.send('u')).rejects.toThrow('no se pudo enviar');
    expect(f.prisma.notificaciones.update.mock.calls[0][0].data.data.push.status).toBe('test_failed');
  });
  it('deactivates invalid tokens and reports failure', async () => {
    const f = setup(); f.fcm.send.mockResolvedValue('invalid');
    await expect(f.service.send('u')).rejects.toThrow();
    expect(f.prisma.user_devices.updateMany).toHaveBeenCalledWith({ where: { id: 'd', usuario_id: 'u', fcm_token: 'token' }, data: { activo: false } });
  });
  it('rejects disabled FCM before accessing devices', async () => {
    const f = setup(); f.fcm.enabled = false;
    await expect(f.service.send('u')).rejects.toThrow('no está habilitado');
    expect(f.tx.user_devices.findMany).not.toHaveBeenCalled();
  });
});
