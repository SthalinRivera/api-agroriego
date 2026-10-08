import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { CultivosService } from './cultivos.service';
import { CreateCultivoDto, UpdateCultivoDto, CultivoQueryDto } from './cultivos.dto';

@ApiTags('Cultivos')
@ApiBearerAuth()
@Controller('cultivos')
@UseGuards(SupabaseAuthGuard)
export class CultivosController {
  constructor(private readonly cultivosService: CultivosService) {}

  @Post()
  @ApiOperation({ summary: 'Crear un nuevo cultivo' })
  async create(@Body() dto: CreateCultivoDto, @Req() req: any) {
    return this.cultivosService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar cultivos' })
  async findAll(@Query() query: CultivoQueryDto, @Req() req: any) {
    return this.cultivosService.findAll(query, req.user.id);
  }

  @Get('parcela/:parcelaId')
  @ApiOperation({ summary: 'Obtener cultivos por parcela' })
  async findByParcela(@Param('parcelaId') parcelaId: string, @Req() req: any) {
    return this.cultivosService.findByParcela(parcelaId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un cultivo por ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.cultivosService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un cultivo' })
  async update(@Param('id') id: string, @Body() dto: UpdateCultivoDto, @Req() req: any) {
    return this.cultivosService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un cultivo' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.cultivosService.delete(id, req.user.id);
  }
}