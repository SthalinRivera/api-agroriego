import { IsString, IsOptional, IsNumber, IsUUID, Min, Max, Length, IsIn, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateReporteDto {
  @ApiProperty({ example: 'uuid-de-la-parcela' })
  @IsUUID()
  parcelaId!: string;

  @ApiProperty({ example: 'reporte_mensual', enum: ['reporte_mensual', 'reporte_riego', 'reporte_alertas', 'reporte_prediccion', 'reporte_personalizado'] })
  @IsIn(['reporte_mensual', 'reporte_riego', 'reporte_alertas', 'reporte_prediccion', 'reporte_personalizado'])
  tipo!: string;

  @ApiProperty({ example: 'Reporte Mensual Enero 2024' })
  @IsString()
  @Length(1, 250)
  titulo!: string;

  @ApiPropertyOptional({ example: 'Resumen de actividad del mes' })
  @IsOptional()
  @IsString()
  descripcion?: string;

  @ApiPropertyOptional({ example: '2024-01-01' })
  @IsOptional()
  @IsDateString()
  fechaInicio?: string;

  @ApiPropertyOptional({ example: '2024-01-31' })
  @IsOptional()
  @IsDateString()
  fechaFin?: string;

  @ApiPropertyOptional({ example: 'pdf', enum: ['pdf', 'excel', 'json'] })
  @IsOptional()
  @IsIn(['pdf', 'excel', 'json'])
  formato?: string = 'pdf';
}

export class ReporteQueryDto {
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

  @ApiPropertyOptional({ example: 'reporte_mensual' })
  @IsOptional()
  @IsIn(['reporte_mensual', 'reporte_riego', 'reporte_alertas', 'reporte_prediccion', 'reporte_personalizado'])
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

export class GenerarReporteIADto {
  @ApiProperty({ example: 'uuid-del-reporte' })
  @IsUUID()
  reporteId!: string;

  @ApiPropertyOptional({ example: 'Resumen ejecutivo del periodo...' })
  @IsOptional()
  @IsString()
  prompt?: string;
}