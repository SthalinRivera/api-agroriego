import { parcelaAccess } from '../../common/shared/parcela-access';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateAlertaDto, UpdateAlertaDto, AtenderAlertaDto, AlertaQueryDto, AlertaEstado, AlertaPrioridad } from './alertas.dto';

@Injectable()
export class AlertasService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAlertaDto, userId: string) {
    // Verificar acceso a la parcela
    const parcela = await this.prisma.parcelas.findUnique({
      where: { id: dto.parcelaId },
    });
    if (!parcela) throw new NotFoundException('Parcela no encontrada');

    const hasAccess = parcela.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: dto.parcelaId, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a esta parcela');

    // Si se especifica dispositivo/sensor, verificar que pertenezcan a la parcela
    if (dto.dispositivoId) {
      const dispositivo = await this.prisma.dispositivos.findUnique({ where: { id: dto.dispositivoId } });
      if (!dispositivo || dispositivo.parcela_id !== dto.parcelaId) {
        throw new BadRequestException('El dispositivo no pertenece a esta parcela');
      }
    }
    if (dto.sensorId) {
      const sensor = await this.prisma.sensores.findUnique({ where: { id: dto.sensorId } });
      if (!sensor || sensor.dispositivo_id !== dto.dispositivoId) {
        throw new BadRequestException('El sensor no pertenece a este dispositivo');
      }
    }

    return this.prisma.alertas.create({
      data: {
        parcela_id: dto.parcelaId,
        dispositivo_id: dto.dispositivoId,
        sensor_id: dto.sensorId,
        tipo: dto.tipo,
        prioridad: dto.prioridad || AlertaPrioridad.MEDIA,
        titulo: dto.titulo,
        mensaje: dto.mensaje,
        valor_detectado: dto.valorDetectado,
        valor_limite: dto.valorLimite,
        estado: AlertaEstado.ACTIVA,
      },
      include: {
        parcelas: { select: { id: true, nombre: true } },
        dispositivos: { select: { id: true, nombre: true } },
        sensores: { select: { id: true, nombre: true } },
      },
    });
  }

  async findAll(query: AlertaQueryDto, userId: string) {
    const { page = 1, limit = 20, parcelaId, estado, prioridad, tipo, desde, hasta } = query;
    const skip = (page - 1) * limit;
    const where: any = { parcelas: parcelaAccess(userId), ...(parcelaId ? { parcela_id: parcelaId } : {}) };
    if (estado) where.estado = estado; if (prioridad) where.prioridad = prioridad; if (tipo) where.tipo = tipo;
    if (desde || hasta) where.created_at = { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) };

    const [data, total] = await Promise.all([
      this.prisma.alertas.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          parcelas: { select: { id: true, nombre: true, codigo: true } },
          dispositivos: { select: { id: true, nombre: true } },
          sensores: { select: { id: true, nombre: true } },
          profiles: { select: { id: true, full_name: true } },
        },
      }),
      this.prisma.alertas.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, userId: string) {
    const alerta = await this.prisma.alertas.findUnique({
      where: { id },
      include: {
        parcelas: { select: { id: true, nombre: true, codigo: true, propietario_id: true } },
        dispositivos: { select: { id: true, nombre: true } },
        sensores: { select: { id: true, nombre: true } },
        profiles: { select: { id: true, full_name: true } },
        notificaciones: true,
      },
    });
    if (!alerta) throw new NotFoundException('Alerta no encontrada');

    // Verificar acceso
    if (alerta.parcelas.propietario_id !== userId) {
      const hasAccess = await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: alerta.parcela_id, usuario_id: userId } },
      });
      if (!hasAccess) throw new ForbiddenException('No tienes acceso a esta alerta');
    }

    return alerta;
  }

  async atender(id: string, dto: AtenderAlertaDto, userId: string) {
    await this.findOne(id, userId); // Verifica acceso
    return this.prisma.alertas.update({
      where: { id },
      data: {
        estado: AlertaEstado.ATENDIDA,
        atendida_por: userId,
        attended_at: new Date(),
      },
    });
  }

  async resolver(id: string, userId: string) {
    await this.findOne(id, userId); // Verifica acceso
    return this.prisma.alertas.update({
      where: { id },
      data: {
        estado: AlertaEstado.RESUELTA,
        atendida_por: userId,
        attended_at: new Date(),
      },
    });
  }

  async descartar(id: string, userId: string) {
    await this.findOne(id, userId); // Verifica acceso
    return this.prisma.alertas.update({
      where: { id },
      data: {
        estado: AlertaEstado.DESCARTADA,
        atendida_por: userId,
        attended_at: new Date(),
      },
    });
  }

  async getActivasByParcela(parcelaId: string, userId: string) {
    // Verificar acceso
    const hasAccess = await this.prisma.parcela_usuarios.findUnique({
      where: { parcela_id_usuario_id: { parcela_id: parcelaId, usuario_id: userId } },
    });
    if (!hasAccess) {
      const parcela = await this.prisma.parcelas.findUnique({ where: { id: parcelaId } });
      if (!parcela || parcela.propietario_id !== userId) {
        throw new ForbiddenException('No tienes acceso a esta parcela');
      }
    }

    return this.prisma.alertas.findMany({
      where: { parcela_id: parcelaId, estado: AlertaEstado.ACTIVA },
      orderBy: { created_at: 'desc' },
      include: {
        dispositivos: { select: { id: true, nombre: true } },
        sensores: { select: { id: true, nombre: true } },
      },
    });
  }

  async getCountByEstado(userId: string) {
    const userParcelas = await this.prisma.parcela_usuarios.findMany({
      where: { usuario_id: userId },
      select: { parcela_id: true },
    });
    const userParcelaIds = userParcelas.map(p => p.parcela_id);

    const ownParcelas = await this.prisma.parcelas.findMany({
      where: { propietario_id: userId },
      select: { id: true },
    });
    const allParcelaIds = [...new Set([...userParcelaIds, ...ownParcelas.map(p => p.id)])];

    const [activa, atendida, resuelta, descartada] = await Promise.all([
      this.prisma.alertas.count({ where: { parcela_id: { in: allParcelaIds }, estado: AlertaEstado.ACTIVA } }),
      this.prisma.alertas.count({ where: { parcela_id: { in: allParcelaIds }, estado: AlertaEstado.ATENDIDA } }),
      this.prisma.alertas.count({ where: { parcela_id: { in: allParcelaIds }, estado: AlertaEstado.RESUELTA } }),
      this.prisma.alertas.count({ where: { parcela_id: { in: allParcelaIds }, estado: AlertaEstado.DESCARTADA } }),
    ]);

    return { activa, atendida, resuelta, descartada, total: activa + atendida + resuelta + descartada };
  }
}