import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../config/prisma/prisma.service';
import { PredictInputDto, CreatePrediccionDto, PrediccionQueryDto } from './predicciones.dto';

@Injectable()
export class PrediccionesService {
  constructor(private prisma: PrismaService) {}

  async predict(input: PredictInputDto, userId: string) {
    // Verificar acceso a la parcela
    const parcela = await this.prisma.parcelas.findUnique({
      where: { id: input.parcelaId },
    });
    if (!parcela) throw new NotFoundException('Parcela no encontrada');

    const hasAccess = parcela.propietario_id === userId ||
      await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: input.parcelaId, usuario_id: userId } },
      });
    if (!hasAccess) throw new ForbiddenException('No tienes acceso a esta parcela');

    // Obtener modelo activo si no se especifica
    let modeloId = input.modeloId;
    if (!modeloId) {
      const modeloActivo = await this.prisma.modelos_ia.findFirst({
        where: { activo: true },
        orderBy: { fecha_entrenamiento: 'desc' },
      });
      if (!modeloActivo) throw new BadRequestException('No hay modelo IA activo');
      modeloId = modeloActivo.id;
    }

    // Obtener cultivo activo de la parcela
    const cultivo = await this.prisma.cultivos.findFirst({
      where: { parcela_id: input.parcelaId, activo: true },
    });

    // Preparar datos de entrada
    const inputData = {
      humedad_suelo: input.humedadSuelo,
      temperatura: input.temperatura,
      humedad_relativa: input.humedadRelativa,
      caudal_lmin: input.caudalLmin,
      dias_desde_ultimo_riego: input.diasDesdeUltimoRiego,
      cantidad_plantas: input.cantidadPlantas || cultivo?.cantidad_plantas,
    };

    // Aquí se llamaría al modelo de IA real
    // Por ahora simulamos una predicción
    const prediccion = this.simularPrediccion(inputData);

    // Guardar predicción
    const saved = await this.prisma.predicciones.create({
      data: {
        parcela_id: input.parcelaId,
        modelo_id: modeloId,
        ...inputData,
        humedad_predicha: prediccion.humedadPredicha,
        tiempo_riego_horas: prediccion.tiempoRiegoHoras,
        volumen_riego_litros: prediccion.volumenRiegoLitros,
        demanda_hidrica_litros: prediccion.demandaHidricaLitros,
        confianza: prediccion.confianza,
        output_data: prediccion.outputData,
        inference_time_ms: prediccion.inferenceTimeMs,
      },
      include: { modelos_ia: true, parcelas: { select: { id: true, nombre: true } } },
    });

    return saved;
  }

  private simularPrediccion(input: any) {
    // Simulación simple basada en reglas (reemplazar con modelo real)
    const { humedad_suelo, temperatura, humedad_relativa, caudal_lmin, dias_desde_ultimo_riego, cantidad_plantas = 100 } = input;

    let humedadPredicha = humedad_suelo;
    let tiempoRiegoHoras = 0;
    let volumenRiegoLitros = 0;
    let demandaHidricaLitros = 0;
    let confianza = 85;

    // Lógica simple de predicción
    if (humedad_suelo < 20) {
      // Suelo muy seco - riego urgente
      tiempoRiegoHoras = 4;
      humedadPredicha = Math.min(humedad_suelo + 15, 40);
      confianza = 95;
    } else if (humedad_suelo < 30) {
      // Suelo seco - riego necesario
      tiempoRiegoHoras = 2.5;
      humedadPredicha = Math.min(humedad_suelo + 10, 35);
      confianza = 90;
    } else if (humedad_suelo < 40) {
      // Suelo aceptable - riego ligero
      tiempoRiegoHoras = 1.5;
      humedadPredicha = Math.min(humedad_suelo + 5, 45);
      confianza = 80;
    } else {
      // Suelo húmedo - no regar
      tiempoRiegoHoras = 0;
      humedadPredicha = humedad_suelo;
      confianza = 70;
    }

    // Ajustar por temperatura
    if (temperatura > 30) {
      tiempoRiegoHoras *= 1.2;
      confianza -= 5;
    }

    // Ajustar por días sin riego
    if (dias_desde_ultimo_riego && dias_desde_ultimo_riego > 3) {
      tiempoRiegoHoras *= 1.15;
    }

    // Calcular volúmenes
    const areaAprox = cantidad_plantas * 6.25; // m² aprox (2.5m x 2.5m por planta)
    volumenRiegoLitros = tiempoRiegoHoras * (caudal_lmin || 20) * 60;
    demandaHidricaLitros = areaAprox * (40 - humedad_suelo) * 0.5; // Estimación simple

    const outputData = {
      reason: tiempoRiegoHoras > 0
        ? `Riego recomendado: ${tiempoRiegoHoras.toFixed(1)}h para elevar humedad a ${humedadPredicha.toFixed(1)}%`
        : 'Humedad adecuada, no se requiere riego',
      schedule: tiempoRiegoHoras > 0 ? '05:00 - 06:00' : null,
      factors: {
        humedad_actual: humedad_suelo,
        temperatura,
        humedad_relativa,
        dias_sin_riego: dias_desde_ultimo_riego,
      },
    };

    return {
      humedadPredicha,
      tiempoRiegoHoras: Number(tiempoRiegoHoras.toFixed(2)),
      volumenRiegoLitros: Number(volumenRiegoLitros.toFixed(2)),
      demandaHidricaLitros: Number(demandaHidricaLitros.toFixed(2)),
      confianza,
      outputData,
      inferenceTimeMs: 150,
    };
  }

  async create(dto: CreatePrediccionDto, userId: string) {
    return this.predict(dto, userId);
  }

  async findAll(query: PrediccionQueryDto, userId: string) {
    const { page = 1, limit = 20, parcelaId, modeloId, desde, hasta } = query;
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

    const where: any = {
      parcela_id: parcelaId ? parcelaId : { in: allParcelaIds },
    };
    if (modeloId) where.modelo_id = modeloId;
    if (desde || hasta) {
      where.created_at = {};
      if (desde) where.created_at.gte = new Date(desde);
      if (hasta) where.created_at.lte = new Date(hasta);
    }

    const [data, total] = await Promise.all([
      this.prisma.predicciones.findMany({
        where,
        skip,
        take: limit,
        orderBy: { created_at: 'desc' },
        include: {
          modelos_ia: { select: { id: true, nombre: true, version: true } },
          parcelas: { select: { id: true, nombre: true, codigo: true } },
        },
      }),
      this.prisma.predicciones.count({ where }),
    ]);

    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  async findOne(id: string, userId: string) {
    const prediccion = await this.prisma.predicciones.findUnique({
      where: { id },
      include: {
        modelos_ia: true,
        parcelas: { select: { id: true, nombre: true, codigo: true } },
        evaluaciones_prediccion: true,
      },
    });
    if (!prediccion) throw new NotFoundException('Predicción no encontrada');

    // Verificar acceso
    if (prediccion.parcela_id) {
      const hasAccess = await this.prisma.parcela_usuarios.findUnique({
        where: { parcela_id_usuario_id: { parcela_id: prediccion.parcela_id, usuario_id: userId } },
      });
      if (!hasAccess) {
        const parcela = await this.prisma.parcelas.findUnique({ where: { id: prediccion.parcela_id } });
        if (!parcela || parcela.propietario_id !== userId) {
          throw new ForbiddenException('No tienes acceso a esta predicción');
        }
      }
    }

    return prediccion;
  }

  async getLatestByParcela(parcelaId: string, userId: string) {
    const hasAccess = await this.prisma.parcela_usuarios.findUnique({
      where: { parcela_id_usuario_id: { parcela_id: parcelaId, usuario_id: userId } },
    });
    if (!hasAccess) {
      const parcela = await this.prisma.parcelas.findUnique({ where: { id: parcelaId } });
      if (!parcela || parcela.propietario_id !== userId) {
        throw new ForbiddenException('No tienes acceso a esta parcela');
      }
    }

    return this.prisma.predicciones.findFirst({
      where: { parcela_id: parcelaId },
      orderBy: { created_at: 'desc' },
      include: { modelos_ia: true },
    });
  }
}