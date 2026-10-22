import { Injectable, Logger } from '@nestjs/common';
import { applicationDefault, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

@Injectable()
export class FcmService {
  private readonly logger = new Logger(FcmService.name);
  get enabled() { return process.env.FCM_ENABLED === 'true'; }
  async send(token: string, notification: { id: string; usuario_id: string; titulo: string; mensaje: string | null }, prioridad: string) {
    if (!this.enabled) throw new Error('FCM_DISABLED');
    const app = getApps().find(a => a.name === 'agro-notifications') ?? initializeApp({
      credential: applicationDefault(), projectId: process.env.FIREBASE_PROJECT_ID,
      httpAgent: undefined,
    }, 'agro-notifications');
    try {
      await getMessaging(app).send({ token,
        notification: { title: notification.titulo, body: notification.mensaje ?? '' },
        data: { notification_id: notification.id, usuario_id: notification.usuario_id, prioridad },
        android: { priority: 'high', ttl: 86400000, notification: { tag: notification.id } },
        apns: { headers: { 'apns-collapse-id': notification.id }, payload: { aps: { sound: 'default' } } },
      });
      return 'sent' as const;
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (['messaging/registration-token-not-registered', 'messaging/invalid-registration-token'].includes(code ?? '')) return 'invalid' as const;
      this.logger.warn(`FCM delivery failed (${code ?? 'unknown'})`);
      throw new Error(code ?? 'FCM_SEND_FAILED');
    }
  }
}
