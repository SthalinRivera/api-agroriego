import { IsInt, IsString, IsOptional, IsNumber, IsUUID, IsDecimal, Min, Max, IsArray, ValidateNested, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateLecturaDto {
  @ApiProperty({ example: 'uuid-del-sensor' })
  @IsUUID()
  sensorId!: string;

  @ApiProperty({ example: 45.5 })
  @Type(() => Number)
  @IsNumber()
  valor!: number;

  @ApiPropertyOptional({ example: 45.3 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorRaw?: number;

  @ApiPropertyOptional({ example: 95.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  calidad?: number;

  @ApiPropertyOptional({ example: '2024-01-15T10:30:00Z' })
  @IsOptional()
  @IsDateString()
  recordedAt?: string;

  @ApiPropertyOptional({ example: '{"rssi": -65, "snr": 10}' })
  @IsOptional()
  metadata?: Record<string, any>;
}

export class BatchLecturasDto {
  @ApiProperty({ type: [CreateLecturaDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateLecturaDto)
  lecturas!: CreateLecturaDto[];
}

export class LecturaQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000)
  limit?: number = 100;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  sensorId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  dispositivoId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  tipoSensorId?: number;

  @ApiPropertyOptional({ example: '2024-01-15T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ example: '2024-01-16T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  hasta?: string;

  @ApiPropertyOptional({ example: 'humedad_suelo' })
  @IsOptional()
  @IsString()
  tipoSensorCodigo?: string;
}

export class LatestLecturasQueryDto {
  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parcelaId?: string;
}
export class MoistureTrendQueryDto {
  @ApiProperty()
  @IsUUID()
  sensorId!: string;

  @ApiPropertyOptional({ enum: [7, 30, 365], default: 7 })
  @IsOptional()
  @Type(() => Number)
  @IsIn([7, 30, 365])
  days: number = 7;
}