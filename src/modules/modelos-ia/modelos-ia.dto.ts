import { IsString, IsOptional, IsNumber, IsUUID, IsDecimal, Min, Max, Length, IsIn, IsBoolean, IsArray } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateModeloIADto {
  @ApiProperty({ example: 'RandomForest v2.1' })
  @IsString()
  @Length(1, 150)
  nombre!: string;

  @ApiProperty({ example: '2.1.0' })
  @IsString()
  @Length(1, 50)
  version!: string;

  @ApiPropertyOptional({ example: 'RandomForest' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  algoritmo?: string;

  @ApiPropertyOptional({ example: 'Modelo para predicción de riego en paltos' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ example: 'Predicción de humedad y tiempo de riego' })
  @IsOptional()
  @IsString()
  objetivo?: string;

  @ApiPropertyOptional({ example: 'https://storage/modelo_rf_v21.pkl' })
  @IsOptional()
  @IsString()
  archivoUrl?: string;

  @ApiPropertyOptional({ example: { n_estimators: 100, max_depth: 10 } })
  @IsOptional()
  configuracion?: Record<string, any>;

  @ApiPropertyOptional({ example: ['humedad_suelo', 'temperatura', 'humedad_relativa'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  features?: string[];

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  activo?: boolean = false;
}

export class UpdateModeloIADto {
  @ApiPropertyOptional({ example: 'RandomForest v2.2' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  nombre?: string;

  @ApiPropertyOptional({ example: '2.2.0' })
  @IsOptional()
  @IsString()
  @Length(1, 50)
  version?: string;

  @ApiPropertyOptional({ example: 'RandomForest' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  algoritmo?: string;

  @ApiPropertyOptional({ example: 0.15 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mae?: number;

  @ApiPropertyOptional({ example: 0.22 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  rmse?: number;

  @ApiPropertyOptional({ example: 5.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  mape?: number;

  @ApiPropertyOptional({ example: 0.92 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  r2?: number;

  @ApiPropertyOptional({ example: 'https://storage/modelo_rf_v22.pkl' })
  @IsOptional()
  @IsString()
  archivoUrl?: string;

  @ApiPropertyOptional({ example: { n_estimators: 150, max_depth: 12 } })
  @IsOptional()
  configuracion?: Record<string, any>;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}