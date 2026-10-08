import { IsString, IsOptional, IsNumber, IsUUID, IsDecimal, Min, Max, IsArray, ValidateNested, IsDateString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PredictInputDto {
  @ApiProperty({ example: 'uuid-de-la-parcela' })
  @IsUUID()
  parcelaId!: string;

  @ApiPropertyOptional({ example: 'uuid-del-modelo' })
  @IsOptional()
  @IsUUID()
  modeloId?: string;

  @ApiProperty({ example: 25.5 })
  @Type(() => Number)
  @IsDecimal()
  humedadSuelo!: number;

  @ApiProperty({ example: 28.3 })
  @Type(() => Number)
  @IsDecimal()
  temperatura!: number;

  @ApiProperty({ example: 65.0 })
  @Type(() => Number)
  @IsDecimal()
  humedadRelativa!: number;

  @ApiPropertyOptional({ example: 15.2 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal()
  caudalLmin?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  diasDesdeUltimoRiego?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidadPlantas?: number;
}

export class CreatePrediccionDto {
  @ApiProperty({ example: 'uuid-de-la-parcela' })
  @IsUUID()
  parcelaId!: string;

  @ApiPropertyOptional({ example: 'uuid-del-modelo' })
  @IsOptional()
  @IsUUID()
  modeloId?: string;

  @ApiProperty({ example: 25.5 })
  @Type(() => Number)
  @IsDecimal()
  humedadSuelo!: number;

  @ApiProperty({ example: 28.3 })
  @Type(() => Number)
  @IsDecimal()
  temperatura!: number;

  @ApiProperty({ example: 65.0 })
  @Type(() => Number)
  @IsDecimal()
  humedadRelativa!: number;

  @ApiPropertyOptional({ example: 15.2 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal()
  caudalLmin?: number;

  @ApiPropertyOptional({ example: 2 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  diasDesdeUltimoRiego?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidadPlantas?: number;
}

export class PrediccionQueryDto {
  @ApiPropertyOptional({ example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ example: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  parcelaId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  modeloId?: string;

  @ApiPropertyOptional({ example: '2024-01-15T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({ example: '2024-01-16T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}