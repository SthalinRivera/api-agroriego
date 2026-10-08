import { Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../config/prisma/prisma.service';

type AuthProfile = Prisma.profilesGetPayload<{
  include: {
    roles: true;
    users: true;
  };
}>;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(authPayload: { user?: { id?: string; email?: string | null } }) {
    const user = authPayload.user;
    if (!user?.id) {
      throw new UnauthorizedException('Usuario no encontrado');
    }

    const profile: AuthProfile | null = await this.prisma.profiles.findUnique({
      where: { id: user.id },
      include: { roles: true, users: true },
    });

    if (!profile || !profile.activo) {
      throw new UnauthorizedException('Usuario no registrado o inactivo en el sistema');
    }

    const email = user.email ?? profile.users.email;
    if (!email) {
      throw new UnauthorizedException('El usuario no tiene un email asociado');
    }

    const [nombres = '', ...apellidos] = (profile.full_name ?? '').trim().split(/\s+/);
    const roles = [{
      id: Number(profile.roles.id),
      nombre: profile.roles.nombre,
      descripcion: profile.roles.descripcion,
    }];

    return {
      id: profile.id,
      id_empresa: null,
      empresa: null,
      email,
      google_uid: profile.id,
      nombres,
      apellidos: apellidos.join(' '),
      telefono: profile.telefono,
      avatar_url: profile.avatar_url,
      estado: profile.activo,
      created_at: profile.created_at,
      roles,
      sede: null,
    };
  }
}
