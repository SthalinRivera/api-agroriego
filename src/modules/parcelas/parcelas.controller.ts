import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ParcelasService } from './parcelas.service';
import { CreateParcelaDto, UpdateParcelaDto, ParcelaQueryDto } from './parcelas.dto';

@ApiTags('Parcelas')
@ApiBearerAuth()
@Controller('parcelas')
@UseGuards(SupabaseAuthGuard)
export class ParcelasController {
  constructor(private readonly parcelasService: ParcelasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear una nueva parcela' })
  async create(@Body() dto: CreateParcelaDto, @Req() req: any) {
    return this.parcelasService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar parcelas del usuario autenticado' })
  async findAll(@Query() query: ParcelaQueryDto, @Req() req: any) {
    return this.parcelasService.findAll(query, req.user.id);
  }

  @Get('dashboard/:id')
  @ApiOperation({ summary: 'Obtener datos del dashboard de una parcela' })
  async getDashboard(@Param('id') id: string, @Req() req: any) {
    return this.parcelasService.getDashboardData(id, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una parcela por ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.parcelasService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar una parcela' })
  async update(@Param('id') id: string, @Body() dto: UpdateParcelaDto, @Req() req: any) {
    return this.parcelasService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar una parcela' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.parcelasService.delete(id, req.user.id);
  }
}