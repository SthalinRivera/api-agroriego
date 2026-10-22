import { parcelaAccess } from '../../common/shared/parcela-access';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateRiegoDto, UpdateRiegoDto, FinalizarRiegoDto, RiegoQueryDto, RiegoEstado, RiegoOrigen } from './riegos.dto';

@Injectable()
export class RiegosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateRiegoDto, userId: string) {
    const parcela = await this.prisma.parcelas.findUnique({ where: { id: dto.parcelaId } });
    if (!parcela) throw new NotFoundException('Parcela no encontrada');

    const hasAccess = parcela.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: dto.parcelaId, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a esta parcela');

    // Verificar si hay un riego en curso en esta parcela
    const riegoEnCurso = await this.prisma.riegos.findFirst({
      where: { parcela_id: dto.parcelaId, estado: RiegoEstado.EN_CURSO },
    });
    if (riegoEnCurso) throw new BadRequestException('Ya hay un riego en curso en esta parcela');

    return this.prisma.riegos.create({
      data: {
        parcela_id: dto.parcelaId,
        creado_por: userId,
        inicio: new Date(),
        origen: dto.origen || RiegoOrigen.MANUAL,
        estado: RiegoEstado.EN_CURSO,
        humedad_inicial: dto.humedadInicial,
        observaciones: dto.observaciones,
      },
      include: { parcelas: { select: { id: true, nombre: true } } },
    });
  }

  async findAll(query: RiegoQueryDto, userId: string) {
    const { page = 1, limit = 20, parcelaId, estado, origen, desde, hasta } = query;
    const skip = (page - 1) * limit;
    const where: any = { parcelas: parcelaAccess(userId), ...(parcelaId ? { parcela_id: parcelaId } : {}) };
    if (estado) where.estado = estado; if (origen) where.origen = origen;
    if (desde || hasta) where.inicio = { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) };

    const [data, total] = await Promise.all([
      this.prisma.riegos.findMany({
        where,
        skip,
        take: limit,
        orderBy: { inicio: 'desc' },
        include: {
          parcelas: { select: { id: true, nombre: true, codigo: true } },
          profiles: { select: { id: true, full_name: true } },
        },
      }),
      this.prisma.riegos.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findByParcela(parcelaId: string, userId: string) {
    const hasAccess = await this.prisma.parcela_usuarios.findUnique({
      where: { parcela_id_usuario_id: { parcela_id: parcelaId, usuario_id: userId } },
    });
    if (!hasAccess) {
      const parcela = await this.prisma.parcelas.findUnique({ where: { id: parcelaId } });
      if (!parcela || parcela.propietario_id !== userId) {
        throw new ForbiddenException('No tienes acceso a esta parcela');
      }
    }

    return this.prisma.riegos.findMany({
      where: { parcela_id: parcelaId },
      orderBy: { inicio: 'desc' },
      take: 50,
    });
  }

  async findOne(id: string, userId: string) {
    const riego = await this.prisma.riegos.findUnique({
      where: { id },
      include: {
        parcelas: { select: { id: true, nombre: true, propietario_id: true } },
        profiles: { select: { id: true, full_name: true } },
      },
    });
    if (!riego) throw new NotFoundException('Riego no encontrado');

    if (riego.parcelas.propietario_id !== userId) {
      const hasAccess = await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: riego.parcela_id, usuario_id: userId } },
      });
      if (!hasAccess) throw new ForbiddenException('No tienes acceso a este riego');
    }

    return riego;
  }

  async update(id: string, dto: UpdateRiegoDto, userId: string) {
    await this.findOne(id, userId);
    const { duracionMinutos, caudalPromedioLmin, volumenLitros, humedadFinal, ...fields } = dto;
    return this.prisma.riegos.update({ where: { id }, data: {
      ...fields, duracion_minutos: duracionMinutos, caudal_promedio_lmin: caudalPromedioLmin,
      volumen_litros: volumenLitros, humedad_final: humedadFinal,
    } });
  }

  async finalizar(id: string, dto: FinalizarRiegoDto, userId: string) {
    const riego = await this.findOne(id, userId);

    if (riego.estado === RiegoEstado.FINALIZADO || riego.estado === RiegoEstado.CANCELADO) {
      throw new BadRequestException('El riego ya está finalizado o cancelado');
    }

    const fin = new Date();
    const duracionMinutos = dto.duracionMinutos ?? Math.round((fin.getTime() - riego.inicio.getTime()) / 60000);

    return this.prisma.riegos.update({
      where: { id },
      data: {
        fin,
        estado: RiegoEstado.FINALIZADO,
        duracion_minutos: duracionMinutos,
        caudal_promedio_lmin: dto.caudalPromedioLmin,
        volumen_litros: dto.volumenLitros,
        humedad_final: dto.humedadFinal,
        observaciones: dto.observaciones,
      },
    });
  }

  async cancelar(id: string, userId: string) {
    const riego = await this.findOne(id, userId);

    if (riego.estado === RiegoEstado.FINALIZADO) {
      throw new BadRequestException('No se puede cancelar un riego ya finalizado');
    }

    return this.prisma.riegos.update({
      where: { id },
      data: { estado: RiegoEstado.CANCELADO, fin: new Date() },
    });
  }

  async getEnCurso(parcelaId: string, userId: string) {
    const hasAccess = await this.prisma.parcela_usuarios.findUnique({
      where: { parcela_id_usuario_id: { parcela_id: parcelaId, usuario_id: userId } },
    });
    if (!hasAccess) {
      const parcela = await this.prisma.parcelas.findUnique({ where: { id: parcelaId } });
      if (!parcela || parcela.propietario_id !== userId) {
        throw new ForbiddenException('No tienes acceso a esta parcela');
      }
    }

    return this.prisma.riegos.findFirst({
      where: { parcela_id: parcelaId, estado: RiegoEstado.EN_CURSO },
    });
  }
}