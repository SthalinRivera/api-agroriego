import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateCultivoDto, UpdateCultivoDto, CultivoQueryDto } from './cultivos.dto';

@Injectable()
export class CultivosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateCultivoDto, userId: string) {
    const parcela = await this.prisma.parcelas.findUnique({ where: { id: dto.parcelaId } });
    if (!parcela) throw new NotFoundException('Parcela no encontrada');

    const hasAccess = parcela.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: dto.parcelaId, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a esta parcela');

    return this.prisma.cultivos.create({
      data: {
        ...dto,
        parcela_id: dto.parcelaId,
        fecha_siembra: dto.fechaSiembra ? new Date(dto.fechaSiembra) : null,
        activo: true,
      },
      include: { parcelas: { select: { id: true, nombre: true } } },
    });
  }

  async findAll(query: CultivoQueryDto, userId: string) {
    const { page = 1, limit = 20, parcelaId, activo } = query;
    const skip = (page - 1) * limit;

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

    const where: any = { parcela_id: parcelaId ? parcelaId : { in: allParcelaIds } };
    if (activo !== undefined) where.activo = activo;

    const [data, total] = await Promise.all([
      this.prisma.cultivos.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { parcelas: { select: { id: true, nombre: true, codigo: true } } },
      }),
      this.prisma.cultivos.count({ where }),
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

    return this.prisma.cultivos.findMany({
      where: { parcela_id: parcelaId, activo: true },
      orderBy: { created_at: 'desc' },
    });
  }

  async findOne(id: string, userId: string) {
    const cultivo = await this.prisma.cultivos.findUnique({
      where: { id },
      include: { parcelas: { select: { id: true, nombre: true, propietario_id: true } } },
    });
    if (!cultivo) throw new NotFoundException('Cultivo no encontrado');

    if (cultivo.parcelas.propietario_id !== userId) {
      const hasAccess = await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: cultivo.parcela_id, usuario_id: userId } },
      });
      if (!hasAccess) throw new ForbiddenException('No tienes acceso a este cultivo');
    }

    return cultivo;
  }

  async update(id: string, dto: UpdateCultivoDto, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.cultivos.update({
      where: { id },
      data: { ...dto, fecha_siembra: dto.fechaSiembra ? new Date(dto.fechaSiembra) : undefined },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.cultivos.delete({ where: { id } });
  }
}