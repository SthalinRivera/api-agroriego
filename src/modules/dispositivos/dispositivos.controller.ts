import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { DispositivosService } from './dispositivos.service';
import { CreateDispositivoDto, UpdateDispositivoDto, DispositivoQueryDto, DeviceHeartbeatDto } from './dispositivos.dto';

@ApiTags('Dispositivos')
@ApiBearerAuth()
@Controller('dispositivos')
@UseGuards(SupabaseAuthGuard)
export class DispositivosController {
  constructor(private readonly dispositivosService: DispositivosService) {}

  @Post()
  @ApiOperation({ summary: 'Registrar un nuevo dispositivo' })
  async create(@Body() dto: CreateDispositivoDto, @Req() req: any) {
    return this.dispositivosService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar dispositivos del usuario' })
  async findAll(@Query() query: DispositivoQueryDto, @Req() req: any) {
    return this.dispositivosService.findAll(query, req.user.id);
  }

  @Get('parcela/:parcelaId')
  @ApiOperation({ summary: 'Obtener dispositivos por parcela' })
  async getByParcela(@Param('parcelaId') parcelaId: string, @Req() req: any) {
    return this.dispositivosService.getByParcela(parcelaId, req.user.id);
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Heartbeat del dispositivo (público con device_uid)' })
  async heartbeat(@Body() dto: DeviceHeartbeatDto) {
    return this.dispositivosService.heartbeat(dto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un dispositivo por ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.dispositivosService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un dispositivo' })
  async update(@Param('id') id: string, @Body() dto: UpdateDispositivoDto, @Req() req: any) {
    return this.dispositivosService.update(id, dto, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un dispositivo' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.dispositivosService.delete(id, req.user.id);
  }
}