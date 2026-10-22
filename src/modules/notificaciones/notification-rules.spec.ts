import { forecastAlerts } from './notification-rules';
import { NotificationWorker } from './notification-worker.service';
import { NotificationDevicesController } from './notification-devices.controller';

function fixture() {
  const alerts: any[] = [], notifications: any[] = [];
  const now = new Date();
  const parcel: any = { id: 'p', activa: true, nombre: 'Campo', propietario_id: 'u1',
    configuracion_alertas: { notificaciones_activas: true, humedad_minima: 25, dispositivo_offline_minutos: 15 },
    parcela_usuarios: [{ usuario_id: 'u1' }, { usuario_id: 'u2' }], predicciones: [],
    dispositivos: [{ id: 'd', nombre: 'ESP32', tipo: 'ESP32', ultima_conexion: now, created_at: now,
      sensores: [{ id: 's', tipos_sensor: { codigo: 'humedad_suelo' }, lecturas: [{ valor: 10, recorded_at: now }] }],
    }],
  };
  const tx: any = {
    $executeRaw: jest.fn(), parcelas: { findUnique: jest.fn(async () => parcel) },
    lecturas: { findFirst: jest.fn(async () => null) },
    alertas: {
      findFirst: jest.fn(async ({ where }) => [...alerts].reverse().find(a => a.tipo === where.tipo)),
      create: jest.fn(async ({ data }) => { const a = { id: `a${alerts.length}`, estado: 'activa', created_at: new Date(), ...data }; alerts.push(a); return a; }),
      updateMany: jest.fn(async ({ where, data }) => { alerts.filter(a => a.tipo === where.tipo && a.estado === where.estado).forEach(a => Object.assign(a, data)); }),
      findMany: jest.fn(async () => alerts.filter(a => a.estado === 'activa')),
    },
    notificaciones: {
      findFirst: jest.fn(async ({ where }) => notifications.find(n => n.alerta_id === where.alerta_id && n.usuario_id === where.usuario_id)),
      create: jest.fn(async ({ data }) => { notifications.push(data); return data; }),
    },
  };
  const prisma: any = { $transaction: jest.fn(async fn => fn(tx)) };
  return { parcel, alerts, notifications, tx, worker: new NotificationWorker(prisma, {} as any) };
}

describe('notification rules', () => {
  it('does not invent forecast horizons from current irrigation recommendations', () => {
    expect(forecastAlerts({ prioridad: 'alta', recomendacion: 'Realizar riego', tiempo_riego_horas: 24 }, 25)).toEqual([]);
  });
  it('accepts only explicit 24/48/72 horizons and deduplicates', () => {
    expect(forecastAlerts({ pronosticos: [
      { horizonte_horas: 24, humedad_predicha: 20 }, { horizonte_horas: 24, requiere_riego: true },
      { horizonte_horas: 48, requiere_riego: true }, { horizonte_horas: 72, humedad_predicha: 22 },
      { horizonte_horas: 12, requiere_riego: true },
    ] }, 25).map(f => f.horizonte_horas)).toEqual([24, 48, 72]);
  });
  it('does not alert for adequate moisture or malformed forecast', () => {
    expect(forecastAlerts({ pronosticos: [{ horizonte_horas: 24, humedad_predicha: 50 }, null, { horizonte_horas: 48, humedad_predicha: '10' }] }, 25)).toEqual([]);
  });
});

describe('automatic notification evaluation', () => {
  it('creates one alert per episode and one notification per authorized user', async () => {
    const f = fixture(); await f.worker.evaluate('p'); await f.worker.evaluate('p');
    expect(f.alerts).toHaveLength(1); expect(f.notifications).toHaveLength(2);
    expect(f.notifications.map(n => n.usuario_id)).toEqual(['u1', 'u2']);
    expect(f.tx.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it('respects disabled notifications', async () => {
    const f = fixture(); f.parcel.configuracion_alertas.notificaciones_activas = false;
    await f.worker.evaluate('p'); expect(f.alerts).toHaveLength(0); expect(f.notifications).toHaveLength(0);
  });
  it('closes a recovered episode with a database-supported state', async () => {
    const f = fixture(); await f.worker.evaluate('p');
    f.parcel.dispositivos[0].sensores[0].lecturas[0].valor = 40;
    await f.worker.evaluate('p'); expect(f.alerts[0].estado).toBe('atendida');
  });
  it('does not treat old sensor readings as current critical moisture', async () => {
    const f = fixture(); f.parcel.dispositivos[0].sensores[0].lecturas[0].recorded_at = new Date(0);
    await f.worker.evaluate('p'); expect(f.alerts).toHaveLength(0);
  });
  it('creates an offline alert once and suppresses stale humidity', async () => {
    const f = fixture(); f.parcel.dispositivos[0].ultima_conexion = new Date(0);
    await f.worker.evaluate('p'); await f.worker.evaluate('p');
    expect(f.alerts.map(a => a.tipo)).toEqual(['esp32_desconectado']);
  });
  it('creates each forecast horizon once across repeated evaluations', async () => {
    const f = fixture(); f.parcel.dispositivos = [];
    f.parcel.predicciones = [{ created_at: new Date(), output_data: { pronosticos: [24,48,72].map(h => ({ horizonte_horas: h, requiere_riego: true })) } }];
    await f.worker.evaluate('p'); await f.worker.evaluate('p');
    expect(f.alerts).toHaveLength(3); expect(f.notifications).toHaveLength(6);
  });
});

describe('device ownership', () => {
  it('uses the authenticated user and scopes revocation to that user', async () => {
    const tx = { user_devices: { updateMany: jest.fn(), upsert: jest.fn() } };
    const prisma: any = { ...tx, $transaction: (fn: any) => fn(tx) };
    const controller = new NotificationDevicesController(prisma);
    await controller.register({ token: 'new', previousToken: 'old', plataforma: 'android' }, { user: { id: 'owner' } });
    expect(tx.user_devices.updateMany.mock.calls[0][0].where).toEqual({ usuario_id: 'owner', fcm_token: 'old' });
    expect(tx.user_devices.upsert.mock.calls[0][0].update.usuario_id).toBe('owner');
    await controller.unregister({ token: 'new' }, { user: { id: 'owner' } });
    expect(tx.user_devices.updateMany.mock.calls[1][0].where).toEqual({ usuario_id: 'owner', fcm_token: 'new' });
  });
});

describe('push delivery retries', () => {
  function deliveryFixture() {
    const notification: any = { id: 'n', usuario_id: 'u', titulo: 'Alerta', mensaje: 'Aviso', created_at: new Date(),
      data: { prioridad: 'alta', push: { status: 'pending', delivered: [], attempts: 0 } },
      alertas: { estado: 'activa', parcelas: { activa: true, propietario_id: 'u', parcela_usuarios: [], configuracion_alertas: { notificaciones_activas: true } } },
    };
    const tx: any = {
      $queryRaw: jest.fn(async () => [{ locked: true }]),
      notificaciones: { findUnique: jest.fn(async () => notification), update: jest.fn(async ({ data }) => Object.assign(notification, data)) },
      user_devices: { findMany: jest.fn(async () => [{ id: 'd1', fcm_token: 't1' }, { id: 'd2', fcm_token: 't2' }]), updateMany: jest.fn() },
    };
    const prisma: any = { notificaciones: { findMany: jest.fn(async () => [notification]) }, $transaction: (fn: any) => fn(tx) };
    const fcm: any = { send: jest.fn(async () => 'sent') };
    return { worker: new NotificationWorker(prisma, fcm), tx, fcm, notification };
  }
  it('retries only failed devices after a partial success', async () => {
    const f = deliveryFixture(); f.fcm.send.mockResolvedValueOnce('sent').mockRejectedValueOnce(new Error('unavailable'));
    await f.worker.dispatch(); expect(f.notification.data.push.status).toBe('retry');
    f.notification.data.push.nextAttempt = 0;
    await f.worker.dispatch(); expect(f.fcm.send).toHaveBeenCalledTimes(3);
    expect(f.notification.data.push.status).toBe('sent');
    await f.worker.dispatch(); expect(f.fcm.send).toHaveBeenCalledTimes(3);
  });
  it('disables invalid tokens', async () => {
    const f = deliveryFixture(); f.fcm.send.mockResolvedValueOnce('invalid');
    await f.worker.dispatch(); expect(f.tx.user_devices.updateMany).toHaveBeenCalledWith({ where: { id: 'd1', fcm_token: 't1', usuario_id: 'u' }, data: { activo: false } });
  });
  it('cancels push when the user loses access to the parcel', async () => {
    const f = deliveryFixture(); f.notification.alertas.parcelas.propietario_id = 'another';
    await f.worker.dispatch(); expect(f.fcm.send).not.toHaveBeenCalled();
    expect(f.notification.data.push.status).toBe('cancelled');
  });
  it('does not send when another instance holds the notification lock', async () => {
    const f = deliveryFixture(); f.tx.$queryRaw.mockResolvedValue([{ locked: false }]);
    await f.worker.dispatch(); expect(f.fcm.send).not.toHaveBeenCalled();
  });
});
