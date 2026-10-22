import { applicationDefault, cert } from 'firebase-admin/app';

export function firebaseCredential(env: NodeJS.ProcessEnv = process.env) {
  const json = env.FIREBASE_SERVICE_ACCOUNT_JSON ?? env.FIREBASE_SERVICE_ACCOUNT;
  if (json) {
    try { return cert(JSON.parse(json)); }
    catch { throw Object.assign(new Error('Invalid Firebase service account'), { code: 'app/invalid-credential' }); }
  }
  if (env.FIREBASE_CLIENT_EMAIL || env.FIREBASE_PRIVATE_KEY) {
    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
      throw Object.assign(new Error('Incomplete Firebase service account'), { code: 'app/invalid-credential' });
    }
    return cert({ projectId: env.FIREBASE_PROJECT_ID, clientEmail: env.FIREBASE_CLIENT_EMAIL,
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  }
  return applicationDefault();
}

const hints: Record<string, string> = {
  'app/invalid-credential': 'El servidor no pudo usar la cuenta de servicio Firebase. Revisa sus variables de entorno y vuelve a desplegar el backend.',
  'app/invalid-app-options': 'Revisa FIREBASE_PROJECT_ID y la cuenta de servicio del backend.',
  'messaging/mismatched-credential': 'El teléfono y el servidor pertenecen a proyectos Firebase distintos. Usa el mismo proyecto en ambos.',
  'messaging/authentication-error': 'Firebase rechazó las credenciales del servidor. Revisa la cuenta de servicio y sus permisos.',
  'messaging/third-party-auth-error': 'Revisa la configuración APNs de iOS en Firebase.',
  'messaging/invalid-apns-credentials': 'Revisa la configuración APNs de iOS en Firebase.',
  'messaging/server-unavailable': 'Firebase no está disponible temporalmente. Intenta de nuevo más tarde.',
  'messaging/internal-error': 'Firebase presentó un error temporal. Intenta de nuevo más tarde.',
  'messaging/quota-exceeded': 'Se alcanzó un límite de envíos de Firebase. Intenta de nuevo más tarde.',
  'messaging/registration-token-not-registered': 'El registro del teléfono venció. Pulsa Activar notificaciones en la app y vuelve a probar.',
  'messaging/invalid-registration-token': 'El registro del teléfono no es válido. Pulsa Activar notificaciones en la app.',
  'messaging/invalid-argument': 'Firebase rechazó los datos del envío. Revisa los registros del backend.',
};
export function safeFcmCode(error: unknown): string {
  const code = (error as { code?: string })?.code;
  return typeof code === 'string' && Object.hasOwn(hints, code) ? code : 'FCM_SEND_FAILED';
}
export function fcmFailureHint(code: string): string {
  return hints[code] ?? 'Revisa los registros del backend en Vercel y la configuración de la cuenta de servicio Firebase.';
}
