import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../config/prisma/prisma.service';
import { FcmService } from './fcm.service';
import { forecastAlerts } from './notification-rules';

@Injectable()
export class NotificationWorker implements OnModuleInit, OnModuleDestroy {
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  private readonly logger = new Logger(NotificationWorker.name);
  constructor(private readonly prisma: PrismaService, private readonly fcm: FcmService) {}
  onModuleInit() {
    if (process.env.NODE_ENV === 'test' || process.env.NOTIFICATIONS_WORKER_ENABLED === 'false') return;
    this.timer = setInterval(() => void this.tick(), 60000);
    this.timer.unref();
    void this.tick();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }
  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const parcels = await this.prisma.parcelas.findMany({ where: { activa: true }, select: { id: true } });
      for (const parcel of parcels) {
        try { await this.evaluate(parcel.id); } catch { this.logger.error(`Notification evaluation failed for parcel ${parcel.id}`); }
      }
      if (this.fcm.enabled) await this.dispatch();
    } catch { this.logger.error('Notification worker failed; retrying next minute'); }
    finally { this.running = false; }
  }
  async evaluate(parcelId: string) {
    await this.prisma.$transaction(async tx => {
      // Serializes alert generation and fan-out across all backend instances.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`notifications:${parcelId}`}))`;
      const parcel = await tx.parcelas.findUnique({ where: { id: parcelId }, include: {
        configuracion_alertas: true, parcela_usuarios: true,
        dispositivos: { where: { activo: true }, include: { sensores: { where: { activo: true }, include: {
          tipos_sensor: true, lecturas: { orderBy: { recorded_at: 'desc' }, take: 1 },
        } } } },
        predicciones: { orderBy: { created_at: 'desc' }, take: 1 },
      } });
      if (!parcel || !parcel.activa) return;
      const config = parcel.configuracion_alertas;
      if (config?.notificaciones_activas === false) return;
      const now = Date.now();
      const offlineMinutes = Math.max(1, config?.dispositivo_offline_minutos ?? 15);
      const minimum = config?.humedad_minima == null ? null : Number(config.humedad_minima);
      const condition = async (type: string, deviceId: string, sensorId: string | null, active: boolean, title: string, message: string, value?: number, limit?: number, recoveryAt?: Date | null) => {
        const where = { parcela_id: parcelId, dispositivo_id: deviceId, sensor_id: sensorId, tipo: type };
        const latest = await tx.alertas.findFirst({ where, orderBy: { created_at: 'desc' } });
        if (!active) {
          await tx.alertas.updateMany({ where: { ...where, estado: 'activa' }, data: { estado: 'atendida', attended_at: new Date() } });
        } else if (!latest || (recoveryAt && recoveryAt > latest.created_at)) {
          await tx.alertas.create({ data: { ...where, titulo: title, mensaje: message, prioridad: 'alta', valor_detectado: value, valor_limite: limit } });
        }
      };
      for (const device of parcel.dispositivos) {
        const age = now - (device.ultima_conexion ?? device.created_at).getTime();
        const offline = age > offlineMinutes * 60000;
        if (device.tipo.toUpperCase().includes('ESP32')) {
          await condition('esp32_desconectado', device.id, null, offline, 'ESP32 desconectado', `${device.nombre} no comunica desde hace más de ${offlineMinutes} minutos.`, age / 60000, offlineMinutes, device.ultima_conexion);
        }
        if (offline || minimum === null) continue;
        for (const sensor of device.sensores) {
          if (!['humedad_suelo', 'soil_moisture'].includes(sensor.tipos_sensor.codigo.toLowerCase())) continue;
          const reading = sensor.lecturas[0];
          if (!reading || now - reading.recorded_at.getTime() > offlineMinutes * 60000 || reading.recorded_at.getTime() > now) continue;
          const value = Number(reading.valor);
          const healthy = await tx.lecturas.findFirst({ where: { sensor_id: sensor.id, valor: { gte: minimum }, recorded_at: { lte: reading.recorded_at } }, orderBy: { recorded_at: 'desc' }, select: { recorded_at: true } });
          await condition('humedad_critica', device.id, sensor.id, value < minimum, 'Humedad del suelo crítica', `${parcel.nombre}: humedad ${value}% (mínimo ${minimum}%).`, value, minimum, healthy?.recorded_at);
        }
      }
      const prediction = parcel.predicciones[0];
      if (prediction && now - prediction.created_at.getTime() < 24 * 3600000) {
        for (const forecast of forecastAlerts(prediction.output_data, minimum)) {
          const type = `riego_predictivo_${forecast.horizonte_horas}h`;
          // One horizon per forecast date, even if inference is recalculated repeatedly.
          const day = new Date(prediction.created_at); day.setUTCHours(0, 0, 0, 0);
          if (!await tx.alertas.findFirst({ where: { parcela_id: parcelId, tipo: type, created_at: { gte: day } } })) {
            await tx.alertas.create({ data: { parcela_id: parcelId, tipo: type,
              prioridad: forecast.horizonte_horas === 24 ? 'alta' : 'media',
              titulo: `Riego previsto a ${forecast.horizonte_horas} horas`,
              mensaje: `${parcel.nombre}: el pronóstico recomienda riego dentro de ${forecast.horizonte_horas} horas.`,
              valor_detectado: forecast.humedad_predicha, valor_limite: minimum,
            } });
          }
        }
      }
      const recipients = [...new Set([parcel.propietario_id, ...parcel.parcela_usuarios.map(u => u.usuario_id)])];
      const alerts = await tx.alertas.findMany({ where: { parcela_id: parcelId, estado: 'activa' } });
      for (const alert of alerts) {
        for (const userId of recipients) {
          if (await tx.notificaciones.findFirst({ where: { alerta_id: alert.id, usuario_id: userId } })) continue;
          await tx.notificaciones.create({ data: { alerta_id: alert.id, usuario_id: userId,
            titulo: alert.titulo, mensaje: alert.mensaje, tipo: alert.tipo.slice(0, 50),
            data: { prioridad: alert.prioridad, parcela_id: parcelId, push: { status: 'pending', attempts: 0, delivered: [] } },
          } });
        }
      }
    }, { timeout: 30000 });
  }
  async dispatch() {
    const rows = await this.prisma.notificaciones.findMany({ where: {
      OR: [
        { data: { path: ['push', 'status'], equals: 'pending' } },
        { AND: [{ data: { path: ['push', 'status'], equals: 'retry' } }, { data: { path: ['push', 'nextAttempt'], lte: Date.now() } }] },
      ],
    }, orderBy: { created_at: 'asc' }, take: 100 });
    for (const row of rows) {
      try {
        await this.prisma.$transaction(async tx => {
          const locks = await tx.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_xact_lock(hashtext(${`push:${row.id}`})) AS locked`;
          if (!locks[0]?.locked) return;
          const notification = await tx.notificaciones.findUnique({ where: { id: row.id }, include: { alertas: { include: { parcelas: { include: { configuracion_alertas: true, parcela_usuarios: true } } } } } });
          if (!notification) return;
          const data = notification.data as Record<string, any>;
          const push = data.push;
          if (!push || !['pending', 'retry'].includes(push.status) || (push.nextAttempt ?? 0) > Date.now()) return;
          const parcel = notification.alertas?.parcelas;
          const authorized = parcel && parcel.activa && parcel.configuracion_alertas?.notificaciones_activas !== false &&
            (parcel.propietario_id === notification.usuario_id || parcel.parcela_usuarios.some(u => u.usuario_id === notification.usuario_id));
          if (!authorized || notification.alertas?.estado !== 'activa' || Date.now() - notification.created_at.getTime() > 86400000) {
            await tx.notificaciones.update({ where: { id: row.id }, data: { data: { ...data, push: { ...push, status: 'cancelled' } } } }); return;
          }
          const devices = await tx.user_devices.findMany({ where: { usuario_id: notification.usuario_id, activo: true } });
          const delivered: string[] = push.delivered ?? [];
          let failed = devices.length === 0;
          for (const device of devices) {
            const key = createHash('sha256').update(device.id + device.fcm_token).digest('hex');
            if (delivered.includes(key)) continue;
            try {
              const result = await this.fcm.send(device.fcm_token, notification, data.prioridad ?? 'media');
              if (result === 'invalid') await tx.user_devices.updateMany({ where: { id: device.id, fcm_token: device.fcm_token, usuario_id: notification.usuario_id }, data: { activo: false } });
              delivered.push(key);
            } catch { failed = true; }
          }
          const attempts = (push.attempts ?? 0) + 1;
          const status = failed ? 'retry' : 'sent';
          await tx.notificaciones.update({ where: { id: row.id }, data: { data: { ...data, push: {
            status, attempts, delivered, nextAttempt: Date.now() + Math.min(3600000, 60000 * 2 ** Math.min(attempts, 6)),
          } } } });
        }, { timeout: 120000, maxWait: 5000 });
      } catch { this.logger.warn(`Push ${row.id} postponed`); }
    }
  }
}
