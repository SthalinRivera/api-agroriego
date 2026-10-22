import { safeFcmCode, fcmFailureHint } from './firebase-config';
import { BadRequestException, HttpException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { FcmService } from './fcm.service';

@Injectable()
export class NotificationTestService {
  constructor(private readonly prisma: PrismaService, private readonly fcm: FcmService) {}

  async send(userId: string) {
    if (!this.fcm.enabled) throw new ServiceUnavailableException('El envío push no está habilitado en el servidor.');
    const { notification, devices } = await this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'notification-test:' + userId}))`;
      const recent = await tx.notificaciones.findFirst({ where: {
        usuario_id: userId, tipo: 'prueba_push', created_at: { gte: new Date(Date.now() - 30000) },
      } });
      if (recent) throw new HttpException('Espera 30 segundos antes de enviar otra prueba.', 429);
      const devices = await tx.user_devices.findMany({ where: { usuario_id: userId, activo: true } });
      if (!devices.length) throw new BadRequestException('No tienes dispositivos registrados. Abre la app, inicia sesión y permite las notificaciones.');
      const notification = await tx.notificaciones.create({ data: {
        usuario_id: userId, tipo: 'prueba_push', titulo: 'Notificación de prueba',
        mensaje: 'Tu sistema de notificaciones está conectado. Esta prueba no necesita ESP32.',
        data: { prioridad: 'baja', prueba: true, push: { status: 'test_sending' } },
      } });
      return { notification, devices };
    });
    // Await FCM in this HTTP request: no timers or background tasks required by Vercel.
    const outcomes = await Promise.all(devices.map(async device => {
      try {
        const result = await this.fcm.send(device.fcm_token, notification, 'baja');
        if (result === 'invalid') await this.prisma.user_devices.updateMany({
          where: { id: device.id, usuario_id: userId, fcm_token: device.fcm_token }, data: { activo: false },
        });
        return result;
      } catch (error) { return safeFcmCode(error); }
    }));
    const errorCodes = [...new Set(outcomes.filter(result => result !== 'sent').map(result => result === 'invalid' ? 'messaging/registration-token-not-registered' : result))];
    const sent = outcomes.filter(result => result === 'sent').length;
    const failed = outcomes.length - sent;
    await this.prisma.notificaciones.update({ where: { id: notification.id }, data: {
      data: { prioridad: 'baja', prueba: true, push: { status: sent ? (failed ? 'test_partial' : 'test_sent') : 'test_failed', sent, failed, errorCodes } },
    } });
    if (!sent) throw new ServiceUnavailableException({ message: 'La prueba quedó en el historial, pero no se pudo enviar el push. ' + fcmFailureHint(errorCodes[0]), code: errorCodes[0] });
    return { id: notification.id, sent, failed, message: failed
      ? `Firebase aceptó el envío a ${sent} dispositivo(s); ${failed} fallaron. ${fcmFailureHint(errorCodes[0])}`
      : 'Prueba aceptada por Firebase. Comprueba tu teléfono y el historial.' };
  }
}
