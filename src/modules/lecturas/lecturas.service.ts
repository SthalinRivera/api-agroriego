import { parcelaAccess } from '../../common/shared/parcela-access';
import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { CreateLecturaDto, BatchLecturasDto, LecturaQueryDto, LatestLecturasQueryDto, MoistureTrendQueryDto } from './lecturas.dto';
import { DeviceLecturaDto } from './device-lectura.dto';

@Injectable()
export class LecturasService {
  constructor(private prisma: PrismaService) { }

  async moistureTrend(query: MoistureTrendQueryDto, userId: string) {
    const { sensorId, days = 7 } = query;
    if (![7, 30, 365].includes(days)) throw new BadRequestException('Periodo no válido');
    const sensor = await this.prisma.sensores.findUnique({
      where: { id: sensorId },
      include: { tipos_sensor: true, dispositivos: { include: { parcelas: true } } },
    });
    if (!sensor) throw new NotFoundException('Sensor no encontrado');
    const owner = sensor.dispositivos.parcelas.propietario_id === userId;
    const member = owner || await this.prisma.parcela_usuarios.findUnique({
      where: {
        parcela_id_usuario_id: {
          parcela_id: sensor.dispositivos.parcela_id, usuario_id: userId,
        }
      },
    });
    if (!member) throw new ForbiddenException('No tienes acceso a este sensor');
    if (!['humedad_suelo', 'soil_moisture'].includes(sensor.tipos_sensor.codigo.toLowerCase())) {
      throw new BadRequestException('El sensor no mide humedad del suelo');
    }
    const until = new Date();
    const since = new Date(until.getTime() - days * 86400000);
    const interval = days === 7 ? 'hour' : 'day';
    // Parameters are bound by Prisma. Aggregate in PostgreSQL, never download
    // a year of raw readings. Empty buckets remain absent, not artificial zeros.
    const rows = await this.prisma.$queryRaw<Array<{
      recorded_at: Date; valor: unknown;
    }>>`
      SELECT MAX(recorded_at) AS recorded_at, AVG(valor) AS valor
      FROM public.lecturas
      WHERE sensor_id = ${sensorId}::uuid
        AND recorded_at >= ${since} AND recorded_at <= ${until}
      GROUP BY date_trunc(${interval}::text, recorded_at AT TIME ZONE 'America/Lima')
      ORDER BY recorded_at ASC
    `;
    return {
      sensorId, days, aggregation: interval, timezone: 'America/Lima',
      desde: since.toISOString(), hasta: until.toISOString(),
      data: rows.map(row => ({ recorded_at: row.recorded_at, valor: Number(row.valor) })),
    };
  }
  async create(dto: CreateLecturaDto, userId: string) {
    // Verificar que el sensor existe y pertenece al usuario
    const sensor = await this.prisma.sensores.findUnique({
      where: { id: dto.sensorId },
      include: { dispositivos: { include: { parcelas: true } } },
    });
    if (!sensor) throw new NotFoundException('Sensor no encontrado');

    const hasAccess = sensor.dispositivos.parcelas.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: sensor.dispositivos.parcela_id, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a este sensor');

    return this.prisma.lecturas.create({
      data: {
        sensor_id: dto.sensorId,
        valor: dto.valor,
        valor_raw: dto.valorRaw,
        calidad: dto.calidad,
        recorded_at: dto.recordedAt ? new Date(dto.recordedAt) : new Date(),
        metadata: dto.metadata || {},
      },
      include: { sensores: { include: { tipos_sensor: true } } },
    });
  }

  async createBatch(dto: BatchLecturasDto, userId: string) {
    // Verificar todos los sensores
    const sensorIds = [...new Set(dto.lecturas.map(l => l.sensorId))];
    const sensores = await this.prisma.sensores.findMany({
      where: { id: { in: sensorIds } },
      include: { dispositivos: { include: { parcelas: true } } },
    });

    if (sensores.length !== sensorIds.length) {
      throw new BadRequestException('Algunos sensores no existen');
    }

    // Verificar acceso a todos
    for (const sensor of sensores) {
      const hasAccess = sensor.dispositivos.parcelas.propietario_id === userId ||
        await this.prisma.parcela_usuarios.findUnique({
          where: { parcela_id_usuario_id: { parcela_id: sensor.dispositivos.parcela_id, usuario_id: userId } },
        });
      if (!hasAccess) throw new ForbiddenException(`No tienes acceso al sensor ${sensor.id}`);
    }

    // Insertar en lote
    const data = dto.lecturas.map(l => ({
      sensor_id: l.sensorId,
      valor: l.valor,
      valor_raw: l.valorRaw,
      calidad: l.calidad,
      recorded_at: l.recordedAt ? new Date(l.recordedAt) : new Date(),
      metadata: l.metadata || {},
    }));

    return this.prisma.lecturas.createMany({ data, skipDuplicates: false });
  }
  // NUEVO MÉTODO PARA EL ESP32
  async createFromDevice(dto: DeviceLecturaDto) {
    // 1. Buscar el dispositivo por su device_uid
    const dispositivo = await this.prisma.dispositivos.findUnique({
      where: { device_uid: dto.device_uid },
      include: { sensores: { include: { tipos_sensor: true } } } // Traemos sus sensores y tipos
    });

    if (!dispositivo) {
      throw new NotFoundException('Dispositivo no registrado');
    }

    // 2. Actualizar la última conexión (para que no salte la alerta de Offline)
    await this.prisma.dispositivos.update({
      where: { id: dispositivo.id },
      data: {
        ultima_conexion: new Date(),
        estado: 'online'
      }
    });

    // 3. Preparar las lecturas
    const lecturasAInsertar: any[] = []; // O usa Prisma.lecturasCreateManyInput[]


    // Mapeamos los valores del ESP32 a los IDs de los sensores en la BD
    // Mapeamos los valores del ESP32 a los IDs de los sensores en la BD
    for (const sensor of dispositivo.sensores) {
      const tipo = sensor.tipos_sensor.codigo.toLowerCase();
      let valor: number | null = null;

      // 👇 AQUÍ ESTÁ LA CORRECCIÓN CON TUS CÓDIGOS EN INGLÉS 👇
      if (tipo.includes('temperature') || tipo.includes('temperatura')) {
        valor = dto.temperatura;
      }
      else if (tipo.includes('humidity') || tipo.includes('humedad_ambiental') || tipo.includes('humedad_relativa')) {
        valor = dto.humedad_ambiental;
      }
      else if (tipo.includes('soil_moisture') || tipo.includes('humedad_suelo')) {
        valor = dto.humedad_suelo;
      }
      else if (tipo.includes('flow') || tipo.includes('caudal')) {
        valor = dto.caudal;
      }

      if (valor !== null) {
        lecturasAInsertar.push({
          sensor_id: sensor.id,
          valor: valor,
          recorded_at: new Date(),
          metadata: { source: 'ESP32_Wokwi' }
        });
      }
    }

    // 4. Guardar todas las lecturas en la tabla 'lecturas'
    if (lecturasAInsertar.length > 0) {
      await this.prisma.lecturas.createMany({
        data: lecturasAInsertar
      });
    }

    return { status: 'ok', message: 'Lecturas guardadas correctamente', count: lecturasAInsertar.length };
  }


  async findAll(query: LecturaQueryDto, userId: string) {
    const { page = 1, limit = 100, sensorId, dispositivoId, tipoSensorId, desde, hasta, tipoSensorCodigo } = query;
    const skip = (page - 1) * limit;
    const where: any = { sensores: { dispositivos: { parcelas: parcelaAccess(userId) } } };
    if (sensorId) where.sensor_id = sensorId; if (dispositivoId) where.sensores.dispositivo_id = dispositivoId; if (tipoSensorId) where.sensores.tipo_sensor_id = BigInt(tipoSensorId); if (tipoSensorCodigo) where.sensores.tipos_sensor = { codigo: tipoSensorCodigo };
    if (desde || hasta) where.recorded_at = { ...(desde ? { gte: new Date(desde) } : {}), ...(hasta ? { lte: new Date(hasta) } : {}) };

    const [data, total] = await Promise.all([
      this.prisma.lecturas.findMany({
        where,
        skip,
        take: limit,
        orderBy: { recorded_at: 'desc' },
        include: {
          sensores: {
            include: {
              tipos_sensor: true,
              dispositivos: { select: { id: true, nombre: true, device_uid: true } },
            },
          },
        },
      }),
      this.prisma.lecturas.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findLatest(query: LatestLecturasQueryDto, userId: string) {
    const { limit = 50, parcelaId } = query;

    if (parcelaId) {
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

      // Obtener sensores de la parcela
      const dispositivos = await this.prisma.dispositivos.findMany({
        where: { parcela_id: parcelaId, activo: true },
        select: { id: true },
      });
      const dispositivoIds = dispositivos.map(d => d.id);

      const sensores = await this.prisma.sensores.findMany({
        where: { dispositivo_id: { in: dispositivoIds }, activo: true },
        select: { id: true },
      });
      const sensorIds = sensores.map(s => s.id);

      return this.prisma.lecturas.findMany({
        where: { sensor_id: { in: sensorIds } },
        take: limit,
        orderBy: { recorded_at: 'desc' },
        include: { sensores: { include: { tipos_sensor: true } } },
      });
    }

    return this.prisma.lecturas.findMany({
      where: { sensores: { activo: true, dispositivos: { parcelas: parcelaAccess(userId) } } },
      take: limit, orderBy: { recorded_at: 'desc' },
      include: { sensores: { include: { tipos_sensor: true } } },
    });
  }

  async getEstadisticas(sensorId: string, userId: string, desde?: string, hasta?: string) {
    const sensor = await this.prisma.sensores.findUnique({
      where: { id: sensorId },
      include: { dispositivos: { include: { parcelas: true } } },
    });
    if (!sensor) throw new NotFoundException('Sensor no encontrado');

    const hasAccess = sensor.dispositivos.parcelas.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: sensor.dispositivos.parcela_id, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a este sensor');

    const where: any = { sensor_id: sensorId };
    if (desde || hasta) {
      where.recorded_at = {};
      if (desde) where.recorded_at.gte = new Date(desde);
      if (hasta) where.recorded_at.lte = new Date(hasta);
    }

    const [aggregate, latest] = await Promise.all([
      this.prisma.lecturas.aggregate({ where, _count: true, _min: { valor: true }, _max: { valor: true }, _avg: { valor: true } }),
      this.prisma.lecturas.findFirst({ where, orderBy: { recorded_at: 'desc' } }),
    ]);
    return { count: aggregate._count, min: aggregate._min.valor, max: aggregate._max.valor, avg: aggregate._avg.valor, latest };
  }
}
