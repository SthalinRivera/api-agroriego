import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { SensoresService } from './sensores.service';
import { CreateSensorDto, UpdateSensorDto, CreateTipoSensorDto, SensorQueryDto } from './sensores.dto';

@ApiTags('Sensores')
@ApiBearerAuth()
@Controller('sensores')
@UseGuards(SupabaseAuthGuard)
export class SensoresController {
  constructor(private readonly sensoresService: SensoresService) {}

  // Tipos de Sensor
  @Post('tipos')
  @ApiOperation({ summary: 'Crear un tipo de sensor' })
  async createTipoSensor(@Body() dto: CreateTipoSensorDto) {
    return this.sensoresService.createTipoSensor(dto);
  }

  @Get('tipos')
  @ApiOperation({ summary: 'Listar tipos de sensor' })
  async findAllTiposSensor() {
    return this.sensoresService.findAllTiposSensor();
  }

  @Get('tipos/:id')
  @ApiOperation({ summary: 'Obtener un tipo de sensor por ID' })
  async findTipoSensorById(@Param('id') id: string) {
    return this.sensoresService.findTipoSensorById(Number(id));
  }

  // Sensores
  @Post()
  @ApiOperation({ summary: 'Crear un nuevo sensor' })
  async create(@Body() dto: CreateSensorDto, @Req() req: any) {
    return this.sensoresService.create(dto, req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar sensores' })
  async findAll(@Query() query: SensorQueryDto, @Req() req: any) {
    return this.sensoresService.findAll(query, req.user.id);
  }

  @Get('dispositivo/:dispositivoId')
  @ApiOperation({ summary: 'Obtener sensores por dispositivo' })
  async findByDispositivo(@Param('dispositivoId') dispositivoId: string, @Req() req: any) {
    return this.sensoresService.findByDispositivo(dispositivoId, req.user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener un sensor por ID' })
  async findOne(@Param('id') id: string, @Req() req: any) {
    return this.sensoresService.findOne(id, req.user.id);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Actualizar un sensor' })
  async update(@Param('id') id: string, @Body() dto: UpdateSensorDto, @Req() req: any) {
    return this.sensoresService.update(id, dto, req.user.id);
  }

  @Post(':id/calibrar')
  @ApiOperation({ summary: 'Calibrar un sensor' })
  async calibrar(@Param('id') id: string, @Body('offset') offset: number, @Req() req: any) {
    return this.sensoresService.calibrar(id, offset, req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Eliminar un sensor' })
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.sensoresService.delete(id, req.user.id);
  }
}