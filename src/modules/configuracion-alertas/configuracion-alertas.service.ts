import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { UpsertConfiguracionAlertaDto } from './configuracion-alertas.dto';

@Injectable()
export class ConfiguracionAlertasService {
  constructor(private prisma: PrismaService) {}

  async upsert(dto: UpsertConfiguracionAlertaDto, userId: string) {
    const parcela = await this.prisma.parcelas.findUnique({ where: { id: dto.parcelaId } });
    if (!parcela) throw new NotFoundException('Parcela no encontrada');

    const hasAccess = parcela.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: dto.parcelaId, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a esta parcela');

    const existing = await this.prisma.configuracion_alertas.findUnique({
      where: { parcela_id: dto.parcelaId },
    });

    const data = {
      humedad_minima: dto.humedadMinima,
      humedad_maxima: dto.humedadMaxima,
      temperatura_minima: dto.temperaturaMinima,
      temperatura_maxima: dto.temperaturaMaxima,
      humedad_relativa_minima: dto.humedadRelativaMinima,
      humedad_relativa_maxima: dto.humedadRelativaMaxima,
      caudal_minimo_lmin: dto.caudalMinimoLmin,
      caudal_maximo_lmin: dto.caudalMaximoLmin,
      bateria_minima: dto.bateriaMinima,
      dispositivo_offline_minutos: dto.dispositivoOfflineMinutos,
      notificaciones_activas: dto.notificacionesActivas,
    };

    if (existing) {
      return this.prisma.configuracion_alertas.update({
        where: { parcela_id: dto.parcelaId },
        data,
        include: { parcelas: { select: { id: true, nombre: true } } },
      });
    }

    return this.prisma.configuracion_alertas.create({
      data: { parcela_id: dto.parcelaId, ...data },
      include: { parcelas: { select: { id: true, nombre: true } } },
    });
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

    return this.prisma.configuracion_alertas.findUnique({
      where: { parcela_id: parcelaId },
      include: { parcelas: { select: { id: true, nombre: true, codigo: true } } },
    });
  }

  async delete(parcelaId: string, userId: string) {
    const parcela = await this.prisma.parcelas.findUnique({ where: { id: parcelaId } });
    if (!parcela) throw new NotFoundException('Parcela no encontrada');

    if (parcela.propietario_id !== userId) {
      throw new ForbiddenException('Solo el propietario puede eliminar la configuración');
    }

    return this.prisma.configuracion_alertas.delete({ where: { parcela_id: parcelaId } });
  }
}