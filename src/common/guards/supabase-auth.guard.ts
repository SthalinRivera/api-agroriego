import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private readonly supabase: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;
    if (!url || !key) {
      throw new Error('Faltan SUPABASE_URL y SUPABASE_ANON_KEY en la API');
    }
    this.supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const authorization: unknown = req.headers.authorization;
    const match =
      typeof authorization === 'string'
        ? /^Bearer\s+(\S+)$/i.exec(authorization.trim())
        : null;
    if (!match) {
      throw new UnauthorizedException('Token no proporcionado');
    }
    const { data, error } = await this.supabase.auth.getUser(match[1]);
    if (error || !data.user) {
      throw new UnauthorizedException('Sesión inválida o vencida');
    }
    req.user = data.user;
    return true;
  }
}
