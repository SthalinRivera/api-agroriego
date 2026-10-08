import { Controller, Get, Post, Put, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { RiegosService } from './riegos.service';
import { CreateRiegoDto, UpdateRiegoDto, FinalizarRiegoDto, RiegoQueryDto } from './riegos.dto';

@ApiTags('Riegos')
@ApiBearerAuth()
@Controller('riegos')
@UseGuards(SupabaseAuthGuard)
export class RiegosController {
  constructor(private readonly riegosService: RiegosService) {}

  @Post()
  @ApiOperation({ summary: 'Iniciar un nuevo riego' })
  async create(@Body() dto: CreateRiegoDto, @Req() req: any) {
    return this.riegosService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar riegos con filtros' })
  async findAll(@Query() query: RiegoQueryDto, @Req() req: any) {
    return this.riegosService.findAll(query, req.user.id);
  }

  @Get('parcela/:parcelaId')
  @ApiOperation({ summary: 'Obtener riegos por parcela' })
  async findByParcela(@Param('parcelaId') parcelaId: string, @Req() req: any) {
    return this.riegosService.findByParcela(parcelaId, req.user.id);
  }

  @Get('parcela/:parcelaId/en-curso')
  @ApiOperation({ summary: 'Obtener riego en curso de una parcela' })
  async getEnCurso(@Param('parcelaId') parcelaId: string, @Req() req: any) {
    return this.riegosService.getEnCurso(parcelaId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un riego por ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.riegosService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un riego' })
  async update(@Param('id') id: string, @Body() dto: UpdateRiegoDto, @Req() req: any) {
    return this.riegosService.update(id, dto, req.user.id);
  }

  @Put(':id/finalizar')
  @ApiOperation({ summary: 'Finalizar un riego' })
  async finalizar(@Param('id') id: string, @Body() dto: FinalizarRiegoDto, @Req() req: any) {
    return this.riegosService.finalizar(id, dto, req.user.id);
  }

  @Put(':id/cancelar')
  @ApiOperation({ summary: 'Cancelar un riego' })
  async cancelar(@Param('id') id: string, @Req() req: any) {
    return this.riegosService.cancelar(id, req.user.id);
  }
}