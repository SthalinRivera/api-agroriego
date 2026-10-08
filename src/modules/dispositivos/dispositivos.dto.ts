import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID, IsDecimal, Min, Max, Length, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateDispositivoDto {
  @ApiProperty({ example: 'uuid-de-la-parcela' })
  @IsUUID()
  parcelaId!: string;

  @ApiProperty({ example: 'ESP32-001-ABC123' })
  @IsString()
  @Length(1, 100)
  deviceUid!: string;

  @ApiProperty({ example: 'Sensor Principal Sector A' })
  @IsString()
  @Length(1, 150)
  nombre!: string;

  @ApiPropertyOptional({ example: 'ESP32', enum: ['ESP32', 'ESP8266', 'Arduino', 'Raspberry Pi', 'Custom'] })
  @IsOptional()
  @IsString()
  @IsIn(['ESP32', 'ESP8266', 'Arduino', 'Raspberry Pi', 'Custom'])
  tipo?: string = 'ESP32';

  @ApiPropertyOptional({ example: 'v1.2.3' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  modelo?: string;

  @ApiPropertyOptional({ example: 'v2.1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  firmwareVersion?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  macAddress?: string;

  @ApiPropertyOptional({ example: 'Secreto para autenticación' })
  @IsOptional()
  @IsString()
  secretHash?: string;
}

export class UpdateDispositivoDto {
  @ApiPropertyOptional({ example: 'Sensor Principal Sector A Actualizado' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  nombre?: string;

  @ApiPropertyOptional({ example: 'ESP32', enum: ['ESP32', 'ESP8266', 'Arduino', 'Raspberry Pi', 'Custom'] })
  @IsOptional()
  @IsString()
  @IsIn(['ESP32', 'ESP8266', 'Arduino', 'Raspberry Pi', 'Custom'])
  tipo?: string;

  @ApiPropertyOptional({ example: 'v1.2.3' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  modelo?: string;

  @ApiPropertyOptional({ example: 'v2.1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  firmwareVersion?: string;

  @ApiPropertyOptional({ example: 'AA:BB:CC:DD:EE:FF' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  macAddress?: string;

  @ApiPropertyOptional({ example: 'online', enum: ['online', 'offline', 'error', 'maintenance'] })
  @IsOptional()
  @IsString()
  @IsIn(['online', 'offline', 'error', 'maintenance'])
  estado?: string;

  @ApiPropertyOptional({ example: 85.5 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({}, { message: 'bateria_porcentaje debe ser decimal' })
  @Min(0)
  @Max(100)
  bateriaPorcentaje?: number;

  @ApiPropertyOptional({ example: -65 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  intensidadSenal?: number;

  @ApiPropertyOptional({ example: '192.168.1.100' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  ipAddress?: string;

  @ApiPropertyOptional({ example: '{"version": "2.1.0", "uptime": 86400}' })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class DispositivoQueryDto {
  @ApiPropertyOptional({ example: 1, description: 'Página (default: 1)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20, description: 'Items por página (default: 20, max: 100)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ example: 'online', enum: ['online', 'offline', 'error', 'maintenance'] })
  @IsOptional()
  @IsString()
  @IsIn(['online', 'offline', 'error', 'maintenance'])
  estado?: string;

  @ApiPropertyOptional({ example: true, description: 'Filtrar solo activos' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class DeviceHeartbeatDto {
  @ApiProperty({ example: 'ESP32-001-ABC123' })
  @IsString()
  deviceUid!: string;

  @ApiPropertyOptional({ example: 85.5 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal()
  @Min(0)
  @Max(100)
  bateriaPorcentaje?: number;

  @ApiPropertyOptional({ example: -65 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  intensidadSenal?: number;

  @ApiPropertyOptional({ example: '192.168.1.100' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  ipAddress?: string;

  @ApiPropertyOptional({ example: 'v2.1.0' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  firmwareVersion?: string;

  @ApiPropertyOptional({ example: '{"uptime": 86400, "freeHeap": 123456}' })
  @IsOptional()
  metadata?: Record<string, any>;
}