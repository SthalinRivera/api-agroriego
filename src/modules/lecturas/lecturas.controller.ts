import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { LecturasService } from './lecturas.service';
import { CreateLecturaDto, BatchLecturasDto, LecturaQueryDto, LatestLecturasQueryDto, MoistureTrendQueryDto } from './lecturas.dto';

@ApiTags('Lecturas')
@ApiBearerAuth()
@Controller('lecturas')
@UseGuards(SupabaseAuthGuard)
export class LecturasController {
  constructor(private readonly lecturasService: LecturasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una lectura individual' })
  async create(@Body() dto: CreateLecturaDto, @Req() req: any) {
    return this.lecturasService.create(dto, req.user.id);
  }

  @Post('batch')
  @ApiOperation({ summary: 'Crear múltiples lecturas en lote' })
  async createBatch(@Body() dto: BatchLecturasDto, @Req() req: any) {
    return this.lecturasService.createBatch(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar lecturas con filtros' })
  async findAll(@Query() query: LecturaQueryDto, @Req() req: any) {
    return this.lecturasService.findAll(query, req.user.id);
  }

  @Get('tendencia-humedad')
  @ApiOperation({ summary: 'Humedad media por hora (7 días) o día (30/365 días)' })
  async moistureTrend(@Query() query: MoistureTrendQueryDto, @Req() req: any) {
    return this.lecturasService.moistureTrend(query, req.user.id);
  }
  @Get('latest')
  @ApiOperation({ summary: 'Obtener últimas lecturas' })
  async findLatest(@Query() query: LatestLecturasQueryDto, @Req() req: any) {
    return this.lecturasService.findLatest(query, req.user.id);
  }

  @Get('sensor/:sensorId/estadisticas')
  @ApiOperation({ summary: 'Obtener estadísticas de un sensor' })
  async getEstadisticas(
    @Param('sensorId') sensorId: string,
    @Query('desde') desde?: string,
    @Query('hasta') hasta?: string,
    @Req() req?: any,
  ) {
    return this.lecturasService.getEstadisticas(sensorId, req.user.id, desde, hasta);
  }
}