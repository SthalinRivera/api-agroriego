import { parcelaAccess } from '../../common/shared/parcela-access';
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

    const { parcelaId, fechaSiembra, cantidadPlantas, edadPromedioAnios, sistemaRiego, marcoPlantacion, ...fields } = dto;
    return this.prisma.cultivos.create({
      data: {
        ...fields,
        cantidad_plantas: cantidadPlantas, edad_promedio_anios: edadPromedioAnios, sistema_riego: sistemaRiego, marco_plantacion: marcoPlantacion,
        parcela_id: dto.parcelaId,
        fecha_siembra: fechaSiembra ? new Date(fechaSiembra) : null,
        activo: true,
      },
      include: { parcelas: { select: { id: true, nombre: true } } },
    });
  }

  async findAll(query: CultivoQueryDto, userId: string) {
    const { page = 1, limit = 20, parcelaId, activo } = query;
    const skip = (page - 1) * limit;
    const where: any = { parcelas: parcelaAccess(userId), ...(parcelaId ? { parcela_id: parcelaId } : {}) };
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
    const { fechaSiembra, cantidadPlantas, edadPromedioAnios, sistemaRiego, marcoPlantacion, ...fields } = dto;
    return this.prisma.cultivos.update({
      where: { id },
      data: { ...fields, cantidad_plantas: cantidadPlantas, edad_promedio_anios: edadPromedioAnios, sistema_riego: sistemaRiego, marco_plantacion: marcoPlantacion, fecha_siembra: fechaSiembra ? new Date(fechaSiembra) : undefined },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.cultivos.delete({ where: { id } });
  }
}