import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ReportesService } from './reportes.service';
import { CreateReporteDto, ReporteQueryDto, GenerarReporteIADto } from './reportes.dto';

@ApiTags('Reportes')
@ApiBearerAuth()
@Controller('reportes')
@UseGuards(SupabaseAuthGuard)
export class ReportesController {
  constructor(private readonly reportesService: ReportesService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo reporte' })
  async create(@Body() dto: CreateReporteDto, @Req() req: any) {
    return this.reportesService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar reportes con filtros' })
  async findAll(@Query() query: ReporteQueryDto, @Req() req: any) {
    return this.reportesService.findAll(query, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un reporte por ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.reportesService.findOne(id, req.user.id);
  }

  @Post(':id/ia')
  @ApiOperation({ summary: 'Generar análisis IA para un reporte' })
  async generarIA(@Param('id') id: string, @Body() dto: GenerarReporteIADto, @Req() req: any) {
    return this.reportesService.generarConIA({ ...dto, reporteId: id }, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un reporte' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.reportesService.delete(id, req.user.id);
  }
}