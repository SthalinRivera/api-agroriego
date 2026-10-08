import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateParcelaDto, UpdateParcelaDto, ParcelaQueryDto } from './parcelas.dto';

@Injectable()
export class ParcelasService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateParcelaDto, userId: string) {
    return this.prisma.parcelas.create({
      data: {
        ...dto,
        propietario_id: userId,
      },
    });
  }

  async findAll(query: ParcelaQueryDto, userId: string) {
    const { page = 1, limit = 20, activa, departamento, search } = query;
    const skip = (page - 1) * limit;

    const where: any = {
      propietario_id: userId,
    };

    if (activa !== undefined) {
      where.activa = activa;
    }
    if (departamento) {
      where.departamento = { contains: departamento, mode: 'insensitive' };
    }
    if (search) {
      where.OR = [
        { nombre: { contains: search, mode: 'insensitive' } },
        { codigo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.parcelas.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          cultivos: { where: { activo: true } },
          dispositivos: { where: { activo: true } },
          _count: { select: { cultivos: true, dispositivos: true, alertas: true } },
        },
      }),
      this.prisma.parcelas.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, userId: string) {
    const parcela = await this.prisma.parcelas.findUnique({
      where: { id },
      include: {
        profiles: { select: { id: true, full_name: true, users: { select: { email: true } } } },
        cultivos: { where: { activo: true } },
        dispositivos: { where: { activo: true }, include: { sensores: true } },
        alertas: { where: { estado: 'activa' }, orderBy: { created_at: 'desc' }, take: 10 },
        predicciones: { orderBy: { created_at: 'desc' }, take: 5 },
        riegos: { orderBy: { inicio: 'desc' }, take: 10 },
        configuracion_alertas: true,
      },
    });

    if (!parcela) {
      throw new NotFoundException('Parcela no encontrada');
    }

    // Verificar acceso (dueño o usuario asignado)
    if (parcela.propietario_id !== userId) {
      const hasAccess = await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: id, usuario_id: userId } },
      });
      if (!hasAccess) {
        throw new ForbiddenException('No tienes acceso a esta parcela');
      }
    }

    return parcela;
  }

  async update(id: string, dto: UpdateParcelaDto, userId: string) {
    await this.findOne(id, userId); // Verifica acceso

    return this.prisma.parcelas.update({
      where: { id },
      data: dto,
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId); // Verifica acceso (solo dueño puede borrar)

    return this.prisma.parcelas.delete({ where: { id } });
  }

  async getDashboardData(parcelaId: string, userId: string) {
    const parcela = await this.findOne(parcelaId, userId);

    const [ultimaLectura, ultimaPrediccion, alertasActivas, riegoActual] = await Promise.all([
      this.prisma.lecturas.findFirst({
        where: { sensores: { dispositivos: { parcela_id: parcelaId } } },
        orderBy: { recorded_at: 'desc' },
        include: { sensores: { include: { tipos_sensor: true } } },
      }),
      this.prisma.predicciones.findFirst({
        where: { parcela_id: parcelaId },
        orderBy: { created_at: 'desc' },
      }),
      this.prisma.alertas.findMany({
        where: { parcela_id: parcelaId, estado: 'activa' },
        orderBy: { created_at: 'desc' },
        take: 10,
      }),
      this.prisma.riegos.findFirst({
        where: { parcela_id: parcelaId, estado: 'en_curso' },
        orderBy: { inicio: 'desc' },
      }),
    ]);

    return {
      parcela,
      ultimaLectura,
      ultimaPrediccion,
      alertasActivas,
      riegoActual,
    };
  }
}