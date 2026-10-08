import { Controller, Get, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { PrediccionesService } from './predicciones.service';
import { PredictInputDto, CreatePrediccionDto, PrediccionQueryDto } from './predicciones.dto';

@ApiTags('Predicciones')
@ApiBearerAuth()
@Controller('predicciones')
@UseGuards(SupabaseAuthGuard)
export class PrediccionesController {
  constructor(private readonly prediccionesService: PrediccionesService) {}

  @Post('predict')
  @ApiOperation({ summary: 'Generar una predicción de riego' })
  async predict(@Body() dto: PredictInputDto, @Req() req: any) {
    return this.prediccionesService.predict(dto, req.user.id);
  }

  @Post()
  @ApiOperation({ summary: 'Crear/guardar una predicción' })
  async create(@Body() dto: CreatePrediccionDto, @Req() req: any) {
    return this.prediccionesService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar predicciones con filtros' })
  async findAll(@Query() query: PrediccionQueryDto, @Req() req: any) {
    return this.prediccionesService.findAll(query, req.user.id);
  }

  @Get('latest/:parcelaId')
  @ApiOperation({ summary: 'Obtener la última predicción de una parcela' })
  async getLatest(@Param('parcelaId') parcelaId: string, @Req() req: any) {
    return this.prediccionesService.getLatestByParcela(parcelaId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener una predicción por ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.prediccionesService.findOne(id, req.user.id);
  }
}