// src/common/guards/supabase-auth.guard.ts
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  private supabase: SupabaseClient;

  constructor() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY;

    if (!url || !key) {
      // Imprime lo que SÍ ve, para depurar
      console.error('❌ Env check:', {
        SUPABASE_URL: url ? 'OK' : 'MISSING',
        SUPABASE_ANON_KEY_OR_SUPABASE_KEY: key ? 'OK' : 'MISSING',
        keys_visibles: Object.keys(process.env).filter((k) =>
          k.startsWith('SUPABASE'),
        ),
      });
      throw new Error('Faltan SUPABASE_URL y/o SUPABASE_ANON_KEY (o SUPABASE_KEY) en .env');
    }

    this.supabase = createClient(url, key);
  }
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;

    if (!auth?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Token no proporcionado');
    }

    const token = auth.slice(7).trim(); // 👈 .trim() por si hay espacios/saltos

    // Log de diagnóstico
    console.log('🔍 Token recibido (primeros 40):', token.substring(0, 40));
    console.log('🔍 Token length:', token.length);
    console.log('🔍 SUPABASE_URL:', process.env.SUPABASE_URL);

    const { data, error } = await this.supabase.auth.getUser(token);

    if (error) {
      console.error('❌ Error de Supabase getUser:', {
        message: error.message,
        status: (error as any).status,
        name: error.name,
      });
      throw new UnauthorizedException(`Token inválido: ${error.message}`);
    }

    if (!data.user) {
      console.error('❌ data.user es null pero sin error');
      throw new UnauthorizedException('Token inválido: usuario no encontrado');
    }

    console.log('✅ Usuario autenticado:', data.user.id, data.user.email);
    req.user = data.user;
    return true;
  }
}