import { firebaseCredential, safeFcmCode, fcmFailureHint } from './firebase-config';
import { cert, applicationDefault } from 'firebase-admin/app';
jest.mock('firebase-admin/app', () => ({ cert: jest.fn(() => ({})), applicationDefault: jest.fn(() => ({})) }));
describe('Firebase server configuration', () => {
  beforeEach(() => jest.clearAllMocks());
  it('reads separate Vercel variables and converts escaped PEM newlines', () => {
    firebaseCredential({ FIREBASE_PROJECT_ID: 'project', FIREBASE_CLIENT_EMAIL: 'service@example.com', FIREBASE_PRIVATE_KEY: 'line1\\nline2' });
    expect(cert).toHaveBeenCalledWith({ projectId: 'project', clientEmail: 'service@example.com', privateKey: 'line1\nline2' });
  });
  it('supports service account JSON without a filesystem path', () => {
    firebaseCredential({ FIREBASE_SERVICE_ACCOUNT_JSON: '{"project_id":"p","client_email":"a","private_key":"k"}' });
    expect(cert).toHaveBeenCalledWith({ project_id: 'p', client_email: 'a', private_key: 'k' });
  });
  it('supports the FIREBASE_SERVICE_ACCOUNT environment variable', () => {
    firebaseCredential({ FIREBASE_SERVICE_ACCOUNT: '{"project_id":"p","client_email":"a","private_key":"k"}' });
    expect(cert).toHaveBeenCalledWith({ project_id: 'p', client_email: 'a', private_key: 'k' });
  });
  it('keeps ADC support', () => { firebaseCredential({}); expect(applicationDefault).toHaveBeenCalled(); });
  it('rejects incomplete or malformed credentials without exposing their contents', () => {
    expect(() => firebaseCredential({ FIREBASE_PRIVATE_KEY: 'secret' })).toThrow('Incomplete Firebase service account');
    expect(() => firebaseCredential({ FIREBASE_SERVICE_ACCOUNT_JSON: 'private-secret' })).toThrow('Invalid Firebase service account');
  });
  it('only exposes allowlisted codes and fixed troubleshooting messages', () => {
    expect(safeFcmCode({ code: 'messaging/mismatched-credential', message: 'secret' })).toBe('messaging/mismatched-credential');
    expect(fcmFailureHint('messaging/mismatched-credential')).toContain('proyectos Firebase distintos');
    expect(safeFcmCode({ code: 'private-secret', message: 'private-secret' })).toBe('FCM_SEND_FAILED');
    expect(fcmFailureHint('private-secret')).not.toContain('private-secret');
  });
});
