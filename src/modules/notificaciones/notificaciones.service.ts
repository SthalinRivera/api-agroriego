import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { NotificacionQueryDto, MarcarLeidaDto } from './notificaciones.dto';

@Injectable()
export class NotificacionesService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: NotificacionQueryDto, userId: string) {
    const { page = 1, limit = 20, leida, desde } = query;
    const skip = (page - 1) * limit;

    const where: any = { usuario_id: userId };
    if (leida !== undefined) where.leida = leida;
    if (desde) where.created_at = { gte: new Date(desde) };

    const [data, total] = await Promise.all([
      this.prisma.notificaciones.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { alertas: { select: { id: true, titulo: true, tipo: true, prioridad: true } } },
      }),
      this.prisma.notificaciones.count({ where }),
    ]);

    return { data: data.map(item => ({ ...item, prioridad: item.alertas?.prioridad ?? (item.data as any)?.prioridad ?? 'media', data: { ...(item.data as any), push: undefined } })), meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async getNoLeidasCount(userId: string) {
    return this.prisma.notificaciones.count({
      where: { usuario_id: userId, leida: false },
    });
  }

  async marcarComoLeida(id: string, userId: string, dto: MarcarLeidaDto) {
    const notificacion = await this.prisma.notificaciones.findUnique({ where: { id } });
    if (!notificacion) throw new NotFoundException('Notificación no encontrada');
    if (notificacion.usuario_id !== userId) throw new ForbiddenException('No tienes acceso a esta notificación');

    return this.prisma.notificaciones.update({
      where: { id },
      data: { leida: dto.leida ?? true, read_at: (dto.leida ?? true) ? new Date() : null },
    });
  }

  async marcarTodasComoLeidas(userId: string) {
    return this.prisma.notificaciones.updateMany({
      where: { usuario_id: userId, leida: false },
      data: { leida: true, read_at: new Date() },
    });
  }

  async createFromAlerta(alertaId: string, usuariosIds: string[]) {
    const alerta = await this.prisma.alertas.findUnique({ where: { id: alertaId }, include: { parcelas: { include: { parcela_usuarios: true, configuracion_alertas: true } } } });
    if (!alerta) throw new NotFoundException('Alerta no encontrada');
    if (alerta.parcelas.configuracion_alertas?.notificaciones_activas === false) return { count: 0 };
    const allowed = new Set([alerta.parcelas.propietario_id, ...alerta.parcelas.parcela_usuarios.map(u => u.usuario_id)]);
    return this.prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'notifications:' + alerta.parcela_id}))`;
      let count = 0;
      for (const usuario_id of new Set(usuariosIds)) {
        if (!allowed.has(usuario_id) || await tx.notificaciones.findFirst({ where: { alerta_id: alertaId, usuario_id } })) continue;
        await tx.notificaciones.create({ data: { usuario_id, alerta_id: alertaId, titulo: alerta.titulo, mensaje: alerta.mensaje, tipo: alerta.tipo.slice(0, 50),
          data: { prioridad: alerta.prioridad, parcela_id: alerta.parcela_id, push: { status: 'pending', attempts: 0, delivered: [] } } } });
        count++;
      }
      return { count };
    });
  }
}
