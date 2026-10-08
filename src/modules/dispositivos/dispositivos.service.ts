import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateDispositivoDto, UpdateDispositivoDto, DispositivoQueryDto, DeviceHeartbeatDto } from './dispositivos.dto';

@Injectable()
export class DispositivosService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateDispositivoDto, userId: string) {
    // Verificar que la parcela pertenece al usuario
    const parcela = await this.prisma.parcelas.findFirst({
      where: { id: dto.parcelaId, propietario_id: userId },
    });
    if (!parcela) {
      throw new ForbiddenException('No tienes acceso a esta parcela');
    }

    return this.prisma.dispositivos.create({
      data: {
        parcela_id: dto.parcelaId,
        device_uid: dto.deviceUid,
        nombre: dto.nombre,
        tipo: dto.tipo,
        modelo: dto.modelo,
        firmware_version: dto.firmwareVersion,
        mac_address: dto.macAddress,
        secret_hash: dto.secretHash,
        estado: 'offline',
        activo: true,
      },
      include: { sensores: true },
    });
  }

  async findAll(query: DispositivoQueryDto, userId: string) {
    const { page = 1, limit = 20, estado, activo } = query;
    const skip = (page - 1) * limit;

    // Obtener parcelas del usuario
    const userParcelas = await this.prisma.parcela_usuarios.findMany({
      where: { usuario_id: userId },
      select: { parcela_id: true },
    });
    const parcelaIds = userParcelas.map(p => p.parcela_id);

    const where: any = {
      parcela_id: { in: parcelaIds },
    };
    if (estado) where.estado = estado;
    if (activo !== undefined) where.activo = activo;

    const [data, total] = await Promise.all([
      this.prisma.dispositivos.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          sensores: { include: { tipos_sensor: true } },
          parcelas: { select: { id: true, nombre: true } },
        },
      }),
      this.prisma.dispositivos.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findOne(id: string, userId: string) {
    const dispositivo = await this.prisma.dispositivos.findUnique({
      where: { id },
      include: {
        sensores: { include: { tipos_sensor: true }, where: { activo: true } },
        parcelas: { select: { id: true, nombre: true, propietario_id: true } },
        alertas: { where: { estado: 'activa' }, take: 10 },
        device_logs: { orderBy: { created_at: 'desc' }, take: 20 },
      },
    });

    if (!dispositivo) {
      throw new NotFoundException('Dispositivo no encontrado');
    }

    // Verificar acceso
    if (dispositivo.parcelas.propietario_id !== userId) {
      const hasAccess = await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: dispositivo.parcela_id, usuario_id: userId } },
      });
      if (!hasAccess) throw new ForbiddenException('No tienes acceso a este dispositivo');
    }

    return dispositivo;
  }

  async update(id: string, dto: UpdateDispositivoDto, userId: string) {
    await this.findOne(id, userId); // Verifica acceso
    return this.prisma.dispositivos.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        tipo: dto.tipo,
        modelo: dto.modelo,
        firmware_version: dto.firmwareVersion,
        mac_address: dto.macAddress,
        estado: dto.estado,
        bateria_porcentaje: dto.bateriaPorcentaje,
        intensidad_senal: dto.intensidadSenal,
        ip_address: dto.ipAddress,
        metadata: dto.metadata,
        activo: dto.activo,
      },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId); // Verifica acceso
    return this.prisma.dispositivos.delete({ where: { id } });
  }

  async heartbeat(dto: DeviceHeartbeatDto) {
    const dispositivo = await this.prisma.dispositivos.findUnique({
      where: { device_uid: dto.deviceUid },
    });

    if (!dispositivo) {
      throw new NotFoundException('Dispositivo no registrado');
    }

    const metadata = {
      ...(typeof dispositivo.metadata === 'object' && dispositivo.metadata !== null && !Array.isArray(dispositivo.metadata)
        ? dispositivo.metadata
        : {}),
      ...dto.metadata,
      lastHeartbeat: new Date().toISOString(),
    };

    return this.prisma.dispositivos.update({
      where: { id: dispositivo.id },
      data: {
        estado: 'online',
        bateria_porcentaje: dto.bateriaPorcentaje,
        intensidad_senal: dto.intensidadSenal,
        ip_address: dto.ipAddress,
        firmware_version: dto.firmwareVersion,
        ultima_conexion: new Date(),
        metadata,
      },
    });
  }

  async getByParcela(parcelaId: string, userId: string) {
    // Verificar acceso a la parcela
    const hasAccess = await this.prisma.parcela_usuarios.findUnique({
      where: { parcela_id_usuario_id: { parcela_id: parcelaId, usuario_id: userId } },
    });
    if (!hasAccess) {
      const parcela = await this.prisma.parcelas.findUnique({ where: { id: parcelaId } });
      if (!parcela || parcela.propietario_id !== userId) {
        throw new ForbiddenException('No tienes acceso a esta parcela');
      }
    }

    return this.prisma.dispositivos.findMany({
      where: { parcela_id: parcelaId, activo: true },
      include: { sensores: { where: { activo: true }, include: { tipos_sensor: true } } },
    });
  }
}