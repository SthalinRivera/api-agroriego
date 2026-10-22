import { IsInt, IsString, IsOptional, IsBoolean, IsNumber, IsUUID, IsDecimal, Min, Max, Length, IsIn } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateSensorDto {
  @ApiProperty({ example: 'ESP32-001-ABC123' })
  @IsUUID()
  dispositivoId!: string;

  @ApiProperty({ example: 1 })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  tipoSensorId!: number;

  @ApiPropertyOptional({ example: 'SENS-001' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  codigo?: string;

  @ApiPropertyOptional({ example: 'Humedad Suelo Sector A' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Capacitivo v2.0' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  modelo?: string;

  @ApiPropertyOptional({ example: 'AgroSense' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  fabricante?: string;

  @ApiPropertyOptional({ example: 'I2C' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  protocolo?: string;

  @ApiPropertyOptional({ example: 'GPIO32' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  pin?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorMinimo?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorMaximo?: number;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offsetCalibracion?: number = 0;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsString()
  fechaCalibracion?: string;

  @ApiPropertyOptional({ example: '{"calibracion": "manual"}' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateSensorDto {
  @ApiPropertyOptional({ example: 'Humedad Suelo Sector A Actualizado' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Capacitivo v2.0' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  modelo?: string;

  @ApiPropertyOptional({ example: 'AgroSense' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  fabricante?: string;

  @ApiPropertyOptional({ example: 'I2C' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  protocolo?: string;

  @ApiPropertyOptional({ example: 'GPIO32' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  pin?: string;

  @ApiPropertyOptional({ example: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorMinimo?: number;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorMaximo?: number;

  @ApiPropertyOptional({ example: 0.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  offsetCalibracion?: number;

  @ApiPropertyOptional({ example: '2024-01-15' })
  @IsOptional()
  @IsString()
  fechaCalibracion?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ example: '{"calibracion": "manual"}' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class CreateTipoSensorDto {
  @ApiProperty({ example: 'humedad_suelo' })
  @IsString()
  @Length(1, 50)
  codigo!: string;

  @ApiProperty({ example: 'Humedad del Suelo' })
  @IsString()
  @Length(1, 150)
  nombre!: string;

  @ApiPropertyOptional({ example: '%' })
  @IsOptional()
  @IsString()
  @Length(1, 30)
  unidad?: string;

  @ApiPropertyOptional({ example: 'Sensor de humedad capacitivo para suelo' })
  @IsOptional()
  @IsString()
  descripcion?: string;
}

export class SensorQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dispositivoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tipoSensorId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  activo?: boolean;
}
export class CalibrarSensorDto {
  @ApiProperty({ example: 0.5 })
  @Type(() => Number)
  @IsNumber()
  offset!: number;
}
