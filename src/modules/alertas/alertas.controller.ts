import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { AlertasService } from './alertas.service';
import { CreateAlertaDto, UpdateAlertaDto, AtenderAlertaDto, AlertaQueryDto } from './alertas.dto';

@ApiTags('Alertas')
@ApiBearerAuth()
@Controller('alertas')
@UseGuards(SupabaseAuthGuard)
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva alerta' })
  async create(@Body() dto: CreateAlertaDto, @Req() req: any) {
    return this.alertasService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar alertas con filtros' })
  async findAll(@Query() query: AlertaQueryDto, @Req() req: any) {
    return this.alertasService.findAll(query, req.user.id);
  }

  @Get('count')
  @ApiOperation({ summary: 'Obtener conteo de alertas por estado' })
  async getCount(@Req() req: any) {
    return this.alertasService.getCountByEstado(req.user.id);
  }

  @Get('parcela/:parcelaId/activas')
  @ApiOperation({ summary: 'Obtener alertas activas de una parcela' })
  async getActivasByParcela(@Param('parcelaId') parcelaId: string, @Req() req: any) {
    return this.alertasService.getActivasByParcela(parcelaId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una alerta por ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.alertasService.findOne(id, req.user.id);
  }

  @Put(':id/atender')
  @ApiOperation({ summary: 'Marcar alerta como atendida' })
  async atender(@Param('id') id: string, @Body() dto: AtenderAlertaDto, @Req() req: any) {
    return this.alertasService.atender(id, dto, req.user.id);
  }

  @Put(':id/resolver')
  @ApiOperation({ summary: 'Marcar alerta como resuelta' })
  async resolver(@Param('id') id: string, @Req() req: any) {
    return this.alertasService.resolver(id, req.user.id);
  }

  @Put(':id/descartar')
  @ApiOperation({ summary: 'Descartar una alerta' })
  async descartar(@Param('id') id: string, @Req() req: any) {
    return this.alertasService.descartar(id, req.user.id);
  }
}