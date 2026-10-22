import { parcelaAccess } from '../../common/shared/parcela-access';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateSensorDto, UpdateSensorDto, CreateTipoSensorDto, SensorQueryDto } from './sensores.dto';

@Injectable()
export class SensoresService {
  constructor(private prisma: PrismaService) {}

  // Tipos de Sensor
  async createTipoSensor(dto: CreateTipoSensorDto) {
    return this.prisma.tipos_sensor.create({ data: dto });
  }

  async findAllTiposSensor() {
    return this.prisma.tipos_sensor.findMany({ orderBy: { nombre: 'asc' } });
  }

  async findTipoSensorById(id: number) {
    const tipo = await this.prisma.tipos_sensor.findUnique({ where: { id: BigInt(id) } });
    if (!tipo) throw new NotFoundException('Tipo de sensor no encontrado');
    return tipo;
  }

  // Sensores
  async create(dto: CreateSensorDto, userId: string) {
    // Verificar que el dispositivo existe y pertenece al usuario
    const dispositivo = await this.prisma.dispositivos.findUnique({
      where: { id: dto.dispositivoId },
      include: { parcelas: true },
    });
    if (!dispositivo) throw new NotFoundException('Dispositivo no encontrado');

    const hasAccess = dispositivo.parcelas.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: dispositivo.parcela_id, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a este dispositivo');

    // Verificar que el tipo de sensor existe
    const tipoSensor = await this.prisma.tipos_sensor.findUnique({ where: { id: dto.tipoSensorId } });
    if (!tipoSensor) throw new BadRequestException('Tipo de sensor no válido');

    return this.prisma.sensores.create({
      data: {
        dispositivo_id: dto.dispositivoId,
        tipo_sensor_id: BigInt(dto.tipoSensorId),
        codigo: dto.codigo,
        nombre: dto.nombre,
        modelo: dto.modelo,
        fabricante: dto.fabricante,
        protocolo: dto.protocolo,
        pin: dto.pin,
        valor_minimo: dto.valorMinimo,
        valor_maximo: dto.valorMaximo,
        offset_calibracion: dto.offsetCalibracion ?? 0,
        fecha_calibracion: dto.fechaCalibracion ? new Date(dto.fechaCalibracion) : null,
        activo: true,
        metadata: dto.metadata || {},
      },
      include: { tipos_sensor: true, dispositivos: { select: { id: true, nombre: true } } },
    });
  }

  async findAll(query: SensorQueryDto, userId: string) {
    const { page = 1, limit = 20, dispositivoId, tipoSensorId, activo } = query;
    const skip = (page - 1) * limit;
    const where: any = { dispositivos: { parcelas: parcelaAccess(userId) } };
    if (dispositivoId) where.dispositivo_id = dispositivoId; if (tipoSensorId) where.tipo_sensor_id = BigInt(tipoSensorId); if (activo !== undefined) where.activo = activo;

    const [data, total] = await Promise.all([
      this.prisma.sensores.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: { tipos_sensor: true, dispositivos: { select: { id: true, nombre: true, device_uid: true } } },
      }),
      this.prisma.sensores.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, userId: string) {
    const sensor = await this.prisma.sensores.findUnique({
      where: { id },
      include: {
        tipos_sensor: true,
        dispositivos: { include: { parcelas: { select: { id: true, nombre: true, propietario_id: true } } } },
        lecturas: { orderBy: { recorded_at: 'desc' }, take: 100 },
      },
    });
    if (!sensor) throw new NotFoundException('Sensor no encontrado');

    const hasAccess = sensor.dispositivos.parcelas.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: sensor.dispositivos.parcela_id, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a este sensor');

    return sensor;
  }

  async findByDispositivo(dispositivoId: string, userId: string) {
    const dispositivo = await this.prisma.dispositivos.findUnique({
      where: { id: dispositivoId },
      include: { parcelas: true },
    });
    if (!dispositivo) throw new NotFoundException('Dispositivo no encontrado');

    const hasAccess = dispositivo.parcelas.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: dispositivo.parcela_id, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a este dispositivo');

    return this.prisma.sensores.findMany({
      where: { dispositivo_id: dispositivoId, activo: true },
      include: { tipos_sensor: true },
    });
  }

  async update(id: string, dto: UpdateSensorDto, userId: string) {
    await this.findOne(id, userId); // Verifica acceso
    return this.prisma.sensores.update({
      where: { id },
      data: {
        nombre: dto.nombre,
        modelo: dto.modelo,
        fabricante: dto.fabricante,
        protocolo: dto.protocolo,
        pin: dto.pin,
        valor_minimo: dto.valorMinimo,
        valor_maximo: dto.valorMaximo,
        offset_calibracion: dto.offsetCalibracion,
        fecha_calibracion: dto.fechaCalibracion ? new Date(dto.fechaCalibracion) : undefined,
        activo: dto.activo,
        metadata: dto.metadata,
      },
      include: { tipos_sensor: true },
    });
  }

  async delete(id: string, userId: string) {
    await this.findOne(id, userId); // Verifica acceso
    return this.prisma.sensores.delete({ where: { id } });
  }

  async calibrar(id: string, offset: number, userId: string) {
    await this.findOne(id, userId);
    return this.prisma.sensores.update({
      where: { id },
      data: {
        offset_calibracion: offset,
        fecha_calibracion: new Date(),
      },
    });
  }
}