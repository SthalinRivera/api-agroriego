import { IsInt, IsString, IsOptional, IsNumber, IsUUID, IsDecimal, Min, Max, Length, IsIn, IsEnum, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum AlertaPrioridad {
  ALTA = 'alta',
  MEDIA = 'media',
  BAJA = 'baja',
}

export enum AlertaEstado {
  ACTIVA = 'activa',
  ATENDIDA = 'atendida',
  RESUELTA = 'resuelta',
  DESCARTADA = 'descartada',
}

export class CreateAlertaDto {
  @ApiProperty({ example: 'uuid-de-la-parcela' })
  @IsUUID()
  parcelaId: string;

  @ApiPropertyOptional({ example: 'uuid-del-dispositivo' })
  @IsOptional()
  @IsUUID()
  dispositivoId?: string;

  @ApiPropertyOptional({ example: 'uuid-del-sensor' })
  @IsOptional()
  @IsUUID()
  sensorId?: string;

  @ApiProperty({ example: 'humedad_baja' })
  @IsString()
  @Length(1, 80)
  tipo: string;

  @ApiPropertyOptional({ example: 'media', enum: AlertaPrioridad })
  @IsOptional()
  @IsEnum(AlertaPrioridad)
  prioridad?: AlertaPrioridad = AlertaPrioridad.MEDIA;

  @ApiProperty({ example: 'Humedad del suelo crítica' })
  @IsString()
  @Length(1, 200)
  titulo: string;

  @ApiPropertyOptional({ example: 'El sector A está por debajo del 20%' })
  @IsOptional()
  @IsString()
  mensaje?: string;

  @ApiPropertyOptional({ example: 18.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorDetectado?: number;

  @ApiPropertyOptional({ example: 25.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  valorLimite?: number;
}

export class UpdateAlertaDto {
  @ApiPropertyOptional({ example: 'activa', enum: AlertaEstado })
  @IsOptional()
  @IsEnum(AlertaEstado)
  estado?: AlertaEstado;

  @ApiPropertyOptional({ example: 'Se revisó el sistema de riego' })
  @IsOptional()
  @IsString()
  mensaje?: string;
}

export class AtenderAlertaDto {
  @ApiPropertyOptional({ example: 'Se aumentó el riego en el sector A' })
  @IsOptional()
  @IsString()
  accion?: string;
}

export class AlertaQueryDto {
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
  parcelaId?: string;

  @ApiPropertyOptional({ enum: AlertaEstado })
  @IsOptional()
  @IsEnum(AlertaEstado)
  estado?: AlertaEstado;

  @ApiPropertyOptional({ enum: AlertaPrioridad })
  @IsOptional()
  @IsEnum(AlertaPrioridad)
  prioridad?: AlertaPrioridad;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  tipo?: string;

  @ApiPropertyOptional({ example: '2024-01-15T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ example: '2024-01-16T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}