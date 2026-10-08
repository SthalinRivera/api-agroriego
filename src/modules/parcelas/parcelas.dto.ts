import { IsString, IsOptional, IsBoolean, IsNumber, IsUUID, IsDecimal, Min, Max, Length } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateParcelaDto {
  @ApiProperty({ example: 'Mi Parcela Los Olivos' })
  @IsString()
  @Length(1, 150)
  nombre!: string;

  @ApiPropertyOptional({ example: 'Parcela de prueba para olivos' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ example: 'Lima' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  departamento?: string;

  @ApiPropertyOptional({ example: 'Lima' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  provincia?: string;

  @ApiPropertyOptional({ example: 'San Martin de Porres' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  distrito?: string;

  @ApiPropertyOptional({ example: 'Av. Principal 123' })
  @IsOptional()
  @IsString()
  localidad?: string;

  @ApiPropertyOptional({ example: 'Km 45 Carretera Central' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ example: -12.0464 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({}, { message: 'latitud debe ser decimal' })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ApiPropertyOptional({ example: -77.0428 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({}, { message: 'longitud debe ser decimal' })
  @Min(-180)
  @Max(180)
  longitud?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({}, { message: 'altitud_msnm debe ser decimal' })
  altitudMsnm?: number;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({}, { message: 'area_hectareas debe ser decimal' })
  @Min(0)
  areaHectareas?: number;
}

export class UpdateParcelaDto {
  @ApiPropertyOptional({ example: 'Mi Parcela Actualizada' })
  @IsOptional()
  @IsString()
  @Length(1, 150)
  nombre?: string;

  @ApiPropertyOptional({ example: 'Descripción actualizada' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ example: 'Lima' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  departamento?: string;

  @ApiPropertyOptional({ example: 'Lima' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  provincia?: string;

  @ApiPropertyOptional({ example: 'San Martin de Porres' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  distrito?: string;

  @ApiPropertyOptional({ example: 'Av. Principal 123' })
  @IsOptional()
  @IsString()
  localidad?: string;

  @ApiPropertyOptional({ example: 'Km 45 Carretera Central' })
  @IsOptional()
  @IsString()
  direccion?: string;

  @ApiPropertyOptional({ example: -12.0464 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({}, { message: 'latitud debe ser decimal' })
  @Min(-90)
  @Max(90)
  latitud?: number;

  @ApiPropertyOptional({ example: -77.0428 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({}, { message: 'longitud debe ser decimal' })
  @Min(-180)
  @Max(180)
  longitud?: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({}, { message: 'altitud_msnm debe ser decimal' })
  altitudMsnm?: number;

  @ApiPropertyOptional({ example: 10.5 })
  @IsOptional()
  @Type(() => Number)
  @IsDecimal({}, { message: 'area_hectareas debe ser decimal' })
  @Min(0)
  areaHectareas?: number;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;
}

export class ParcelaQueryDto {
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

  @ApiPropertyOptional({ example: true, description: 'Filtrar solo parcelas activas' })
  @IsOptional()
  @IsBoolean()
  activa?: boolean;

  @ApiPropertyOptional({ example: 'Lima', description: 'Filtrar por departamento' })
  @IsOptional()
  @IsString()
  departamento?: string;

  @ApiPropertyOptional({ example: 'olivos', description: 'Buscar por nombre (parcial)' })
  @IsOptional()
  @IsString()
  search?: string;
}

export class ParcelaResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  propietarioId!: string;

  @ApiProperty()
  codigo!: string;

  @ApiProperty()
  nombre!: string;

  @ApiPropertyOptional()
  descripcion?: string;

  @ApiPropertyOptional()
  departamento?: string;

  @ApiPropertyOptional()
  provincia?: string;

  @ApiPropertyOptional()
  distrito?: string;

  @ApiPropertyOptional()
  localidad?: string;

  @ApiPropertyOptional()
  direccion?: string;

  @ApiPropertyOptional()
  latitud?: number;

  @ApiPropertyOptional()
  longitud?: number;

  @ApiPropertyOptional()
  altitudMsnm?: number;

  @ApiPropertyOptional()
  areaHectareas?: number;

  @ApiProperty()
  activa!: boolean;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}