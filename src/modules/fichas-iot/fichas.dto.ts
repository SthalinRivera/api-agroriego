import { Type } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
export class MetadataDto {
  @IsOptional() @IsString() @MaxLength(30) anexo?: string;
  @IsOptional() @IsString() @MaxLength(200) responsable?: string;
  @IsOptional() @IsString() @MaxLength(500) ubicacion?: string;
  @IsOptional() @IsString() @MaxLength(200) cultivo?: string;
  @IsOptional() @IsNumber() @Min(0) @Max(500) profundidadCm?: number;
  @IsOptional()
  @IsIn(['sin_determinar', 'relativa', 'volumetrica_calibrada'])
  tipoHumedad?: string;
  @IsOptional() @IsString() @MaxLength(1000) evidenciaCalibracion?: string;
  @IsOptional() @IsString() @MaxLength(2000) observaciones?: string;
}
export class CreateFichaDto extends MetadataDto {
  @IsUUID() parcelaId!: string;
  @IsUUID() dispositivoId!: string;
  @IsUUID() sensorId!: string;
  @IsOptional() @IsUUID() modeloId?: string;
  @IsOptional() @IsString() @MaxLength(50) version?: string;
  @IsDateString() @Matches(/(Z|[+-]\d{2}:\d{2})$/) desde!: string;
  @IsDateString() @Matches(/(Z|[+-]\d{2}:\d{2})$/) hasta!: string;
  @IsNumber() @Min(0) @Max(1440) toleranciaMinutos = 30;
  @IsNumber() @Min(0) @Max(1440) toleranciaAdquisicionMinutos = 5;
  @IsOptional() @IsNumber() @Min(0.1) @Max(10080) intervaloMinutos?: number;
  @IsOptional()
  @IsDateString()
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  inicioProgramacion?: string;
}
export class FichaPageDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
  @IsOptional() @IsIn(['a', 'b']) section: 'a' | 'b' = 'a';
}
