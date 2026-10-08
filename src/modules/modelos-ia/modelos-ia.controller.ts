import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ModelosIAService } from './modelos-ia.service';
import { CreateModeloIADto, UpdateModeloIADto } from './modelos-ia.dto';

@ApiTags('Modelos IA')
@ApiBearerAuth()
@Controller('modelos-ia')
@UseGuards(SupabaseAuthGuard)
export class ModelosIAController {
  constructor(private readonly modelosService: ModelosIAService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo modelo IA' })
  async create(@Body() dto: CreateModeloIADto) {
    return this.modelosService.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar modelos IA' })
  async findAll(@Query('activo') activo?: string) {
    return this.modelosService.findAll(activo === 'true' ? true : activo === 'false' ? false : undefined);
  }

  @Get('activo')
  @ApiOperation({ summary: 'Obtener el modelo activo' })
  async findActivo() {
    return this.modelosService.findActivo();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un modelo por ID' })
  async findOne(@Param('id') id: string) {
    return this.modelosService.findOne(id);
  }

  @Get(':id/metricas')
  @ApiOperation({ summary: 'Obtener métricas de evaluación del modelo' })
  async getMetricas(@Param('id') id: string) {
    return this.modelosService.getMetricas(id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un modelo' })
  async update(@Param('id') id: string, @Body() dto: UpdateModeloIADto) {
    return this.modelosService.update(id, dto);
  }

  @Put(':id/activar')
  @ApiOperation({ summary: 'Activar un modelo (desactiva los demás)' })
  async activar(@Param('id') id: string) {
    return this.modelosService.activar(id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un modelo' })
  async delete(@Param('id') id: string) {
    return this.modelosService.delete(id);
  }
}