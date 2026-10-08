import { Controller, Get, Post, Delete, Body, Param, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { ConfiguracionAlertasService } from './configuracion-alertas.service';
import { UpsertConfiguracionAlertaDto } from './configuracion-alertas.dto';

@ApiTags('Configuración de Alertas')
@ApiBearerAuth()
@Controller('configuracion-alertas')
@UseGuards(SupabaseAuthGuard)
export class ConfiguracionAlertasController {
  constructor(private readonly configService: ConfiguracionAlertasService) {}

  @Post()
  @ApiOperation({ summary: 'Crear o actualizar configuración de alertas' })
  async upsert(@Body() dto: UpsertConfiguracionAlertaDto, @Req() req: any) {
    return this.configService.upsert(dto, req.user.id);
  }

  @Get(':parcelaId')
  @ApiOperation({ summary: 'Obtener configuración de alertas de una parcela' })
  async findByParcela(@Param('parcelaId') parcelaId: string, @Req() req: any) {
    return this.configService.findByParcela(parcelaId, req.user.id);
  }

  @Delete(':parcelaId')
  @ApiOperation({ summary: 'Eliminar configuración de alertas' })
  async delete(@Param('parcelaId') parcelaId: string, @Req() req: any) {
    return this.configService.delete(parcelaId, req.user.id);
  }
}