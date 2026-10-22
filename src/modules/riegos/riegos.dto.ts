import { IsInt, IsString, IsOptional, IsNumber, IsUUID, IsDecimal, Min, Max, Length, IsIn, IsDateString, IsBoolean, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RiegoOrigen {
  MANUAL = 'manual',
  AUTOMATICO = 'automatico',
  PROGRAMADO = 'programado',
}

export enum RiegoEstado {
  EN_CURSO = 'en_curso',
  FINALIZADO = 'finalizado',
  CANCELADO = 'cancelado',
  PAUSADO = 'pausado',
}

export class CreateRiegoDto {
  @ApiProperty({ example: 'uuid-de-la-parcela' })
  @IsUUID()
  parcelaId!: string;

  @ApiPropertyOptional({ example: 'manual', enum: RiegoOrigen })
  @IsOptional()
  @IsEnum(RiegoOrigen)
  origen?: RiegoOrigen = RiegoOrigen.MANUAL;

  @ApiPropertyOptional({ example: 30.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  humedadInicial?: number;

  @ApiPropertyOptional({ example: 'Observaciones del riego' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateRiegoDto {
  @ApiPropertyOptional({ example: 'finalizado', enum: RiegoEstado })
  @IsOptional()
  @IsEnum(RiegoEstado)
  estado?: RiegoEstado;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  duracionMinutos?: number;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  caudalPromedioLmin?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  volumenLitros?: number;

  @ApiPropertyOptional({ example: 45.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  humedadFinal?: number;

  @ApiPropertyOptional({ example: 'Riego completado sin problemas' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class FinalizarRiegoDto {
  @ApiPropertyOptional({ example: 45.0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  humedadFinal?: number;

  @ApiPropertyOptional({ example: 5000 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  volumenLitros?: number;

  @ApiPropertyOptional({ example: 25.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  caudalPromedioLmin?: number;

  @ApiPropertyOptional({ example: 120 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  duracionMinutos?: number;

  @ApiPropertyOptional({ example: 'Riego completado' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class RiegoQueryDto {
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

  @ApiPropertyOptional({ enum: RiegoEstado })
  @IsOptional()
  @IsEnum(RiegoEstado)
  estado?: RiegoEstado;

  @ApiPropertyOptional({ enum: RiegoOrigen })
  @IsOptional()
  @IsEnum(RiegoOrigen)
  origen?: RiegoOrigen;

  @ApiPropertyOptional({ example: '2024-01-15T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ example: '2024-01-16T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}