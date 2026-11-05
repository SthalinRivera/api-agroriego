import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../config/prisma/prisma.service';
import { parcelaAccess } from '../../common/shared/parcela-access';
import { CreateFichaDto, FichaPageDto, MetadataDto } from './fichas.dto';
import { calculate, validMoisture } from './fichas.calculate';
import {
  aColumns,
  bColumns,
  Forecast,
  LEGEND,
  Reading,
  Row,
  Schedule,
  Snapshot,
  TITLE,
} from './fichas.types';
const object = (x: unknown): Record<string, unknown> =>
  x && typeof x === 'object' && !Array.isArray(x)
    ? (x as Record<string, unknown>)
    : {};
const moistureCodes = ['humedad_suelo', 'soil_moisture'];
const timestamp = (x: unknown): x is string =>
  typeof x === 'string' &&
  /(Z|[+-]\d{2}:\d{2})$/.test(x) &&
  Number.isFinite(Date.parse(x));
@Injectable()
export class FichasService {
  constructor(private readonly prisma: PrismaService) {}
  private async access(parcelaId: string, userId: string, write = false) {
    const parcela = await this.prisma.parcelas.findFirst({
      where: { id: parcelaId, ...parcelaAccess(userId) },
      include: { parcela_usuarios: { where: { usuario_id: userId } } },
    });
    if (!parcela)
      throw new ForbiddenException('No tienes acceso a esta parcela');
    const canEdit =
      parcela.propietario_id === userId ||
      parcela.parcela_usuarios.some((p) =>
        ['admin', 'editor', 'tecnico'].includes(p.nivel_acceso),
      );
    if (write && !canEdit)
      throw new ForbiddenException(
        'Crear fichas o editar sus metadatos requiere acceso de editor, técnico o propietario',
      );
    return { parcela, canEdit };
  }
  async options(userId: string) {
    const [parcelas, modelos] = await Promise.all([
      this.prisma.parcelas.findMany({
        where: parcelaAccess(userId),
        select: { id: true, nombre: true },
        orderBy: { nombre: 'asc' },
        take: 2001,
      }),
      this.prisma.modelos_ia.findMany({
        select: { id: true, nombre: true, version: true },
        orderBy: { nombre: 'asc' },
        take: 2001,
      }),
    ]);
    if (parcelas.length > 2000 || modelos.length > 2000)
      throw new PayloadTooLargeException(
        'Demasiadas opciones para esta vista. Se requiere paginar el catálogo.',
      );
    return { parcelas, modelos };
  }
  async context(parcelaId: string, userId: string) {
    const { parcela, canEdit } = await this.access(parcelaId, userId);
    const dispositivos = await this.prisma.dispositivos.findMany({
      where: { parcela_id: parcelaId },
      select: {
        id: true,
        nombre: true,
        device_uid: true,
        sensores: {
          where: { tipos_sensor: { codigo: { in: moistureCodes } } },
          select: { id: true, nombre: true, codigo: true },
        },
      },
      take: 2001,
    });
    if (dispositivos.length > 2000)
      throw new PayloadTooLargeException(
        'Demasiados equipos para esta parcela',
      );
    return {
      parcela: { id: parcela.id, nombre: parcela.nombre },
      canEdit,
      dispositivos,
    };
  }
  async list(userId: string, query: FichaPageDto) {
    const where = { tipo: 'ficha_iot', parcelas: parcelaAccess(userId) };
    const [data, total] = await Promise.all([
      this.prisma.reportes.findMany({
        where,
        select: {
          id: true,
          titulo: true,
          created_at: true,
          parcelas: { select: { nombre: true } },
        },
        orderBy: { created_at: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.reportes.count({ where }),
    ]);
    return { data, total };
  }
  async load(id: string, userId: string) {
    const report = await this.prisma.reportes.findFirst({
      where: { id, tipo: 'ficha_iot', parcelas: parcelaAccess(userId) },
    });
    if (!report)
      throw new NotFoundException('Ficha no encontrada o sin permiso');
    const snapshot = report.metadata as unknown as Snapshot;
    if (snapshot.schema !== 1)
      throw new BadRequestException('Versión de ficha no compatible');
    return { report, snapshot };
  }
  async view(id: string, userId: string, query: FichaPageDto) {
    const { report, snapshot } = await this.load(id, userId);
    const { canEdit } = await this.access(report.parcela_id, userId);
    const { a, b, ...summary } = snapshot;
    const rows = query.section === 'a' ? a : b;
    return {
      ...summary,
      canEdit,
      columns: { a: aColumns, b: bColumns },
      legend: LEGEND,
      section: query.section,
      rows: rows.slice(
        (query.page - 1) * query.limit,
        query.page * query.limit,
      ),
      total: rows.length,
      page: query.page,
      limit: query.limit,
    };
  }
  private applyMetadata(general: Row, dto: MetadataDto) {
    const map: Record<keyof MetadataDto, string> = {
      anexo: 'Anexo',
      responsable: 'Responsable',
      ubicacion: 'Ubicación',
      cultivo: 'Cultivo',
      profundidadCm: 'Profundidad del sensor (cm)',
      tipoHumedad: 'Tipo de humedad',
      evidenciaCalibracion: 'Evidencia de calibración',
      observaciones: 'Observaciones',
    };
    const result = { ...general };
    for (const key of Object.keys(map) as (keyof MetadataDto)[]) {
      const value = dto[key];
      if (value !== undefined) result[map[key]] = value;
    }
    if (
      result['Tipo de humedad'] === 'volumetrica_calibrada' &&
      !String(result['Evidencia de calibración'] || '').trim()
    )
      throw new BadRequestException(
        'Indica la evidencia de calibración volumétrica; no se puede asumir por el porcentaje del sensor',
      );
    return result;
  }
  async update(id: string, dto: MetadataDto, userId: string) {
    const { report, snapshot } = await this.load(id, userId);
    await this.access(report.parcela_id, userId, true);
    snapshot.general = this.applyMetadata(snapshot.general, dto);
    snapshot.general['Metadatos editados en'] = new Date().toISOString();
    snapshot.general['Metadatos editados por'] = userId;
    await this.prisma.reportes.update({
      where: { id },
      data: { metadata: snapshot as unknown as Prisma.InputJsonValue },
    });
    return this.view(id, userId, new FichaPageDto());
  }
  async create(dto: CreateFichaDto, userId: string) {
    await this.access(dto.parcelaId, userId, true);
    const cutoff = new Date();
    const start = new Date(dto.desde);
    const end = new Date(dto.hasta);
    if (start > end || end > cutoff)
      throw new BadRequestException(
        'El inicio debe ser anterior al fin y el fin no puede ser futuro',
      );
    if (end.getTime() - start.getTime() > 366 * 86400000)
      throw new BadRequestException(
        'El periodo máximo es 366 días; divide periodos mayores en fichas',
      );
    if (Boolean(dto.intervaloMinutos) !== Boolean(dto.inicioProgramacion))
      throw new BadRequestException(
        'El intervalo declarado requiere una fecha de inicio de programación, y viceversa',
      );
    if (dto.inicioProgramacion && new Date(dto.inicioProgramacion) > start)
      throw new BadRequestException(
        'La programación declarada debe comenzar antes o al inicio del periodo',
      );
    const snapshot = await this.prisma.$transaction(
      async (tx) => {
        const sensor = await tx.sensores.findFirst({
          where: {
            id: dto.sensorId,
            dispositivo_id: dto.dispositivoId,
            dispositivos: { parcela_id: dto.parcelaId },
            tipos_sensor: { codigo: { in: moistureCodes } },
          },
          include: {
            tipos_sensor: true,
            dispositivos: {
              include: {
                parcelas: { include: { cultivos: true } },
                sensores: { include: { tipos_sensor: true } },
              },
            },
          },
        });
        if (!sensor)
          throw new BadRequestException(
            'Selecciona un sensor de humedad del suelo del dispositivo y parcela indicados',
          );
        if (
          !['%', '%RH', 'porcentaje'].includes(sensor.tipos_sensor.unidad || '')
        )
          throw new BadRequestException(
            'La unidad del sensor debe estar registrada en porcentaje; no se convierte automáticamente',
          );
        const device = sensor.dispositivos;
        const parcela = device.parcelas;
        const warnings = [
          'Los cálculos usan exclusivamente los datos visibles al corte; generar otra ficha crea una nueva instantánea.',
          'created_at se muestra como recepción/registro en el servidor, no como hora física de llegada del paquete.',
          'Las predicciones del sistema pueden proceder del simulador de reglas. Solo se verifican pronósticos originales con horizonte explícito y no marcados como simulados.',
        ];
        const metadata = object(device.metadata);
        const sensorMetadata = object(sensor.metadata);
        const rawSchedule = object(metadata.adquisicion).historial;
        let schedule: Schedule[] = [];
        if (rawSchedule !== undefined) {
          if (!Array.isArray(rawSchedule))
            throw new BadRequestException(
              'El historial de adquisición debe ser una lista',
            );
          schedule = (rawSchedule as unknown[]).map((raw) => {
            const s = object(raw);
            if (
              !timestamp(s.desde) ||
              typeof s.intervaloMinutos !== 'number' ||
              !Number.isFinite(s.intervaloMinutos) ||
              s.intervaloMinutos <= 0
            )
              throw new BadRequestException(
                'El historial de adquisición del dispositivo es inválido',
              );
            return {
              desde: new Date(s.desde).toISOString(),
              intervaloMinutos: s.intervaloMinutos,
            };
          });
        }
        let scheduleSource = schedule.length
          ? 'Historial del dispositivo'
          : 'Sin programación histórica disponible';
        if (
          !schedule.length &&
          dto.intervaloMinutos &&
          dto.inicioProgramacion
        ) {
          schedule = [
            {
              desde: new Date(dto.inicioProgramacion).toISOString(),
              intervaloMinutos: dto.intervaloMinutos,
            },
          ];
          scheduleSource =
            'Programación declarada por el responsable (no acreditada por historial del equipo)';
          warnings.push(scheduleSource);
        } else if (schedule.length && dto.intervaloMinutos)
          warnings.push(
            'Se utilizó el historial real del equipo; se ignoró el intervalo manual.',
          );
        const temperatureSensors = device.sensores.filter(
          (s) =>
            ['temperature', 'temperatura', 'temperatura_ambiental'].includes(
              s.tipos_sensor.codigo.toLowerCase(),
            ) && ['°C', 'C', 'celsius'].includes(s.tipos_sensor.unidad || ''),
        );
        const humiditySensors = device.sensores.filter(
          (s) =>
            ['humidity', 'humedad_ambiental', 'humedad_relativa'].includes(
              s.tipos_sensor.codigo.toLowerCase(),
            ) &&
            ['%', '%RH', 'porcentaje'].includes(s.tipos_sensor.unidad || ''),
        );
        if (temperatureSensors.length !== 1)
          warnings.push(
            'Temperatura ambiental no disponible: falta un sensor único con unidad °C.',
          );
        if (humiditySensors.length !== 1)
          warnings.push(
            'Humedad relativa no disponible: falta un sensor único con unidad %.',
          );
        const temperatureId =
          temperatureSensors.length === 1
            ? temperatureSensors[0].id
            : undefined;
        const humidityId =
          humiditySensors.length === 1 ? humiditySensors[0].id : undefined;
        const observationEnd = new Date(
          Math.min(
            cutoff.getTime(),
            end.getTime() + (48 * 60 + dto.toleranciaMinutos) * 60000,
          ),
        );
        const readingWhere: Prisma.lecturasWhereInput = {
          sensor_id: {
            in: [sensor.id, temperatureId, humidityId].filter(
              (id): id is string => Boolean(id),
            ),
          },
          recorded_at: { gte: start, lte: observationEnd },
          created_at: { lte: cutoff },
        };
        const predictionWhere: Prisma.prediccionesWhereInput = {
          parcela_id: dto.parcelaId,
          ...(dto.modeloId ? { modelo_id: dto.modeloId } : {}),
          created_at: { gte: start, lte: end },
        };
        const irrigationWhere: Prisma.riegosWhereInput = {
          parcela_id: dto.parcelaId,
          inicio: { lte: end },
          created_at: { lte: cutoff },
          estado: { in: ['finalizado', 'en_curso'] },
        };
        const [readingCount, predictionCount, irrigationCount] =
          await Promise.all([
            tx.lecturas.count({ where: readingWhere }),
            tx.predicciones.count({ where: predictionWhere }),
            tx.riegos.count({ where: irrigationWhere }),
          ]);
        if (
          readingCount > 50000 ||
          predictionCount > 10000 ||
          irrigationCount > 10000
        )
          throw new PayloadTooLargeException(
            'La ficha excede el límite de 50 000 lecturas o 10 000 predicciones/riegos. Reduce el periodo; no se han truncado datos.',
          );
        const [rawReadings, predictions, irrigations, profile] =
          await Promise.all([
            tx.lecturas.findMany({
              where: readingWhere,
              orderBy: [{ recorded_at: 'asc' }, { id: 'asc' }],
            }),
            tx.predicciones.findMany({
              where: predictionWhere,
              include: { modelos_ia: true },
              orderBy: [{ created_at: 'asc' }, { id: 'asc' }],
            }),
            tx.riegos.findMany({
              where: irrigationWhere,
              select: { inicio: true },
              orderBy: { inicio: 'asc' },
            }),
            tx.profiles.findUnique({
              where: { id: userId },
              select: { full_name: true },
            }),
          ]);
        const readings: Reading[] = rawReadings.map((r) => {
          const meta = object(r.metadata);
          const unknownTime =
            meta.measurement_time_source === 'server_receipt' ||
            (meta.source === 'ESP32_Wokwi' &&
              meta.measurement_time_source !== 'device');
          return {
            id: String(r.id),
            sensorId: r.sensor_id,
            at: unknownTime ? null : r.recorded_at.toISOString(),
            receivedAt: r.created_at.toISOString(),
            value:
              meta.valid === false ||
              (r.calidad !== null && Number(r.calidad) <= 0)
                ? null
                : Number(r.valor),
            messageId:
              typeof meta.message_id === 'string' ? meta.message_id : undefined,
            note: unknownTime
              ? 'Sin fecha de medición del equipo; se conserva la fecha de registro'
              : typeof meta.observaciones === 'string'
                ? meta.observaciones.slice(0, 500)
                : '',
          };
        });
        if (readings.some((r) => r.at === null))
          warnings.push(
            'Hay lecturas sin fecha de medición acreditada: no se asocian a horarios ni se usan para verificar predicciones.',
          );
        const forecasts: Forecast[] = [];
        let excluded = 0;
        for (const prediction of predictions) {
          const output = object(prediction.output_data);
          const version =
            typeof output.modelo_version === 'string'
              ? output.modelo_version
              : null;
          if (dto.version && version !== dto.version) {
            excluded++;
            continue;
          }
          if (output.simulado === true || !Array.isArray(output.pronosticos)) {
            excluded++;
            continue;
          }
          const horizons = new Set<number>();
          for (const raw of output.pronosticos as unknown[]) {
            const f = object(raw);
            if (
              (f.horizonte_horas !== 24 && f.horizonte_horas !== 48) ||
              typeof f.humedad_predicha !== 'number' ||
              !validMoisture(f.humedad_predicha) ||
              horizons.has(f.horizonte_horas)
            )
              continue;
            horizons.add(f.horizonte_horas);
            forecasts.push({
              id: prediction.id,
              issuedAt: prediction.created_at.toISOString(),
              model: prediction.modelos_ia?.nombre || 'Sin modelo identificado',
              version,
              horizon: f.horizonte_horas,
              value: f.humedad_predicha,
            });
          }
          if (!horizons.size) excluded++;
        }
        if (excluded)
          warnings.push(
            `${excluded} predicciones excluidas: simuladas, sin horizonte original explícito 24/48 h, valor inválido o versión histórica no coincidente.`,
          );
        if (forecasts.some((f) => !f.version))
          warnings.push(
            'Algunas predicciones no conservaron su versión original. Se muestra Sin dato; no se sustituye por la versión actual del catálogo.',
          );
        warnings.push(
          'No existe identificación de un conjunto de evaluación temporal en el esquema actual: las métricas son operativas del periodo, no métricas de prueba.',
        );
        const result = calculate({
          start: start.toISOString(),
          end: end.toISOString(),
          cutoff: cutoff.toISOString(),
          readings: readings.filter((r) => r.sensorId === sensor.id),
          temperature: readings.filter((r) => r.sensorId === temperatureId),
          humidity: readings.filter((r) => r.sensorId === humidityId),
          irrigations: irrigations.map((r) => r.inicio.toISOString()),
          forecasts,
          schedule,
          tolerance: dto.toleranciaMinutos,
          acquisitionTolerance: dto.toleranciaAdquisicionMinutos,
        });
        if (!result.completeSchedule)
          warnings.push(
            'Sin programación completa: registros esperados, disponibilidad y pérdida no están disponibles. No se infiere la programación a partir de las lecturas.',
          );
        const id = randomUUID();
        const general = this.applyMetadata(
          {
            Anexo: '',
            Parcela: `${parcela.nombre} (${parcela.codigo})`,
            Ubicación:
              [
                parcela.departamento,
                parcela.provincia,
                parcela.distrito,
                parcela.localidad,
                parcela.direccion,
              ]
                .filter(Boolean)
                .join(', ') || null,
            Cultivo:
              parcela.cultivos
                .map(
                  (c) => `${c.cultivo}${c.variedad ? ` - ${c.variedad}` : ''}`,
                )
                .join('; ') || null,
            'Dispositivo IoT': `${device.nombre} (${device.device_uid})`,
            'Sensor de humedad': sensor.nombre || sensor.codigo || sensor.id,
            'Profundidad del sensor (cm)':
              typeof sensorMetadata.profundidad_cm === 'number'
                ? sensorMetadata.profundidad_cm
                : null,
            'Tipo de humedad':
              sensorMetadata.tipo_humedad === 'relativa' ||
              sensorMetadata.tipo_humedad === 'volumetrica_calibrada'
                ? sensorMetadata.tipo_humedad
                : 'sin_determinar',
            'Evidencia de calibración':
              typeof sensorMetadata.evidencia_calibracion === 'string'
                ? sensorMetadata.evidencia_calibracion
                : null,
            'Inicio del periodo': start.toISOString(),
            'Fin del periodo': end.toISOString(),
            'Fuente de programación': scheduleSource,
            'Intervalos programados (min)': schedule.length
              ? [...new Set(schedule.map((s) => s.intervaloMinutos))].join(', ')
              : null,
            Responsable: profile?.full_name || null,
            'Modelo predictivo': dto.modeloId
              ? (
                  await tx.modelos_ia.findUnique({
                    where: { id: dto.modeloId },
                    select: { nombre: true },
                  })
                )?.nombre || null
              : 'Todos los modelos',
            'Versión filtrada': dto.version || 'Todas las versiones originales',
            Observaciones: '',
            'Origen de datos generales':
              'Catálogos del sistema al corte; los campos completados por el responsable son declaraciones, no calibraciones verificadas',
          },
          dto,
        );
        const snapshot: Snapshot = {
          schema: 1,
          id,
          code: `FIOT-${id}`,
          cutoff: cutoff.toISOString(),
          timezone: 'America/Lima',
          general,
          filters: {
            parcelaId: dto.parcelaId,
            dispositivoId: dto.dispositivoId,
            sensorId: dto.sensorId,
            modeloId: dto.modeloId || null,
            version: dto.version || null,
            desde: start.toISOString(),
            hasta: end.toISOString(),
            toleranciaMinutos: dto.toleranciaMinutos,
            toleranciaAdquisicionMinutos: dto.toleranciaAdquisicionMinutos,
          },
          warnings,
          schedule,
          a: result.a,
          b: result.b,
          c: result.c,
          counts: result.counts,
        };
        await tx.reportes.create({
          data: {
            id,
            parcela_id: dto.parcelaId,
            usuario_id: userId,
            tipo: 'ficha_iot',
            titulo: `${snapshot.code} · ${parcela.nombre}`,
            formato: 'pdf,xlsx',
            generado_por: 'usuario',
            fecha_inicio: start,
            fecha_fin: end,
            metadata: snapshot as unknown as Prisma.InputJsonValue,
            descripcion: TITLE,
          },
        });
        return snapshot;
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
        timeout: 60000,
        maxWait: 10000,
      },
    );
    return this.view(snapshot.id, userId, new FichaPageDto());
  }
}
