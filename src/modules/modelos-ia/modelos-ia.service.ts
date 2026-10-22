import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateModeloIADto, UpdateModeloIADto } from './modelos-ia.dto';

@Injectable()
export class ModelosIAService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateModeloIADto) {
    // Verificar que no exista mismo nombre y versión
    const existing = await this.prisma.modelos_ia.findUnique({
      where: { nombre_version: { nombre: dto.nombre, version: dto.version } },
    });
    if (existing) throw new BadRequestException('Ya existe un modelo con ese nombre y versión');

    // Si se marca como activo, desactivar los demás
    if (dto.activo) {
      await this.prisma.modelos_ia.updateMany({ where: { activo: true }, data: { activo: false } });
    }

    const { archivoUrl, ...fields } = dto;
    return this.prisma.modelos_ia.create({
      data: {
        ...fields,
        archivo_url: archivoUrl,
        configuracion: dto.configuracion || {},
        features: dto.features || [],
        fecha_entrenamiento: new Date(),
        activo: dto.activo ?? false,
      },
    });
  }

  async findAll(activo?: boolean) {
    const where: any = {};
    if (activo !== undefined) where.activo = activo;
    return this.prisma.modelos_ia.findMany({
      where,
      orderBy: { created_at: 'desc' },
    });
  }

  async findActivo() {
    return this.prisma.modelos_ia.findFirst({
      where: { activo: true },
      orderBy: { fecha_entrenamiento: 'desc' },
    });
  }

  async findOne(id: string) {
    const modelo = await this.prisma.modelos_ia.findUnique({ where: { id } });
    if (!modelo) throw new NotFoundException('Modelo IA no encontrado');
    return modelo;
  }

  async update(id: string, dto: UpdateModeloIADto) {
    const modelo = await this.findOne(id);

    // Si se marca como activo, desactivar los demás
    if (dto.activo && !modelo.activo) {
      await this.prisma.modelos_ia.updateMany({ where: { activo: true, id: { not: id } }, data: { activo: false } });
    }

    const { archivoUrl, ...fields } = dto;
    return this.prisma.modelos_ia.update({
      where: { id },
      data: { ...fields, archivo_url: archivoUrl },
    });
  }

  async activar(id: string) {
    const modelo = await this.findOne(id);
    await this.prisma.modelos_ia.updateMany({ where: { activo: true, id: { not: id } }, data: { activo: false } });
    return this.prisma.modelos_ia.update({ where: { id }, data: { activo: true } });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.modelos_ia.delete({ where: { id } });
  }

  async getMetricas(id: string) {
    const modelo = await this.findOne(id);
    const evaluaciones = await this.prisma.evaluaciones_prediccion.findMany({
      where: { predicciones: { modelo_id: id } },
      orderBy: { evaluated_at: 'desc' },
      take: 100,
    });

    if (evaluaciones.length === 0) {
      return { modelo, evaluaciones: [], resumen: null };
    }

    const mae = evaluaciones.reduce((a, b) => a + Number(b.error_absoluto || 0), 0) / evaluaciones.length;
    const rmse = Math.sqrt(evaluaciones.reduce((a, b) => a + Math.pow(Number(b.error_absoluto || 0), 2), 0) / evaluaciones.length);
    const mape = evaluaciones.reduce((a, b) => a + Number(b.error_porcentual || 0), 0) / evaluaciones.length;

    return {
      modelo,
      evaluaciones,
      resumen: {
        total: evaluaciones.length,
        mae: Number(mae.toFixed(4)),
        rmse: Number(rmse.toFixed(4)),
        mape: Number(mape.toFixed(2)),
      },
    };
  }
}