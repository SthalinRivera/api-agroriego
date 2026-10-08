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
        include: { alertas: { select: { id: true, titulo: true, tipo: true } } },
      }),
      this.prisma.notificaciones.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
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
      data: { leida: dto.leida ?? true, read_at: dto.leida ? new Date() : null },
    });
  }

  async marcarTodasComoLeidas(userId: string) {
    return this.prisma.notificaciones.updateMany({
      where: { usuario_id: userId, leida: false },
      data: { leida: true, read_at: new Date() },
    });
  }

  async createFromAlerta(alertaId: string, usuariosIds: string[]) {
    const alerta = await this.prisma.alertas.findUnique({
      where: { id: alertaId },
      select: { id: true, titulo: true, mensaje: true, tipo: true },
    });
    if (!alerta) throw new NotFoundException('Alerta no encontrada');

    const data = usuariosIds.map(usuarioId => ({
      usuario_id: usuarioId,
      alerta_id: alertaId,
      titulo: alerta.titulo,
      mensaje: alerta.mensaje,
      tipo: alerta.tipo,
      leida: false,
    }));

    return this.prisma.notificaciones.createMany({ data });
  }
}