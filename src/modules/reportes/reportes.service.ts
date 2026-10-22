import { parcelaAccess } from '../../common/shared/parcela-access';
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateReporteDto, ReporteQueryDto, GenerarReporteIADto } from './reportes.dto';

@Injectable()
export class ReportesService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateReporteDto, userId: string) {
    const parcela = await this.prisma.parcelas.findUnique({ where: { id: dto.parcelaId } });
    if (!parcela) throw new NotFoundException('Parcela no encontrada');

    const hasAccess = parcela.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: dto.parcelaId, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a esta parcela');

    return this.prisma.reportes.create({
      data: {
        parcela_id: dto.parcelaId,
        usuario_id: userId,
        tipo: dto.tipo,
        titulo: dto.titulo,
        descripcion: dto.descripcion,
        fecha_inicio: dto.fechaInicio ? new Date(dto.fechaInicio) : null,
        fecha_fin: dto.fechaFin ? new Date(dto.fechaFin) : null,
        formato: dto.formato,
        generado_por: 'sistema',
      },
      include: { parcelas: { select: { id: true, nombre: true } } },
    });
  }

  async findAll(query: ReporteQueryDto, userId: string) {
    const { page = 1, limit = 20, parcelaId, tipo, desde, hasta } = query;
    const skip = (page - 1) * limit;
    const where: any = { parcelas: parcelaAccess(userId), ...(parcelaId ? { parcela_id: parcelaId } : {}) };
    if (tipo) where.tipo = tipo;
    if (desde || hasta) where.created_at = { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) };

    const [data, total] = await Promise.all([
      this.prisma.reportes.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          parcelas: { select: { id: true, nombre: true, codigo: true } },
          profiles: { select: { id: true, full_name: true } },
          reportes_ia: true,
        },
      }),
      this.prisma.reportes.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, userId: string) {
    const reporte = await this.prisma.reportes.findUnique({
      where: { id },
      include: {
        parcelas: { select: { id: true, nombre: true, propietario_id: true } },
        profiles: { select: { id: true, full_name: true } },
        reportes_ia: true,
      },
    });
    if (!reporte) throw new NotFoundException('Reporte no encontrado');

    if (reporte.parcelas.propietario_id !== userId) {
      const hasAccess = await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: reporte.parcela_id, usuario_id: userId } },
      });
      if (!hasAccess) throw new ForbiddenException('No tienes acceso a este reporte');
    }

    return reporte;
  }

  async generarConIA(dto: GenerarReporteIADto, userId: string) {
    const reporte = await this.findOne(dto.reporteId, userId);

    // Aquí se llamaría a un servicio de IA (OpenAI, etc.)
    // Por ahora simulamos
    const iaContent = {
      modelo: 'GPT-4',
      resumen: `Resumen generado por IA para el reporte: ${reporte.titulo}`,
      diagnostico: 'El cultivo presenta condiciones normales...',
      tendencias: 'Humedad del suelo estable, ligera tendencia ascendente',
      recomendaciones: [
        'Mantener riego actual',
        'Monitorear sensores sector B',
      ].join('\n'),
      riesgos: 'Bajo riesgo de estrés hídrico',
      prompt_version: '1.0',
      tokens_entrada: 1500,
      tokens_salida: 800,
      tiempo_generacion_ms: 2500,
    };

    return this.prisma.reportes_ia.create({
      data: {
        reporte_id: dto.reporteId,
        ...iaContent,
      },
    });
  }

  async delete(id: string, userId: string) {
    const reporte = await this.findOne(id, userId);
    if (reporte.usuario_id !== userId && reporte.parcelas.propietario_id !== userId) {
      throw new ForbiddenException('No tienes permiso para eliminar este reporte');
    }
    return this.prisma.reportes.delete({ where: { id } });
  }
}