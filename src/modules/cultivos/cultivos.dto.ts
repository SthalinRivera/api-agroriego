import { IsInt, IsString, IsOptional, IsNumber, IsUUID, IsDecimal, Min, Max, Length, IsIn, IsBoolean, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateCultivoDto {
  @ApiProperty({ example: 'uuid-de-la-parcela' })
  @IsUUID()
  parcelaId!: string;

  @ApiPropertyOptional({ example: 'Palta', enum: ['Palta', 'Uva', 'Arandano', 'Citricos', 'Otros'] })
  @IsOptional()
  @IsString()
  @IsIn(['Palta', 'Uva', 'Arandano', 'Citricos', 'Otros'])
  cultivo?: string = 'Palta';

  @ApiPropertyOptional({ example: 'Hass' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  variedad?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidadPlantas?: number;

  @ApiPropertyOptional({ example: 3.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  edadPromedioAnios?: number;

  @ApiPropertyOptional({ example: '2020-03-15' })
  @IsOptional()
  @IsDateString()
  fechaSiembra?: string;

  @ApiPropertyOptional({ example: 'Goteo', enum: ['Goteo', 'Aspersion', 'Gravedad', 'Hidroponia'] })
  @IsOptional()
  @IsString()
  @IsIn(['Goteo', 'Aspersion', 'Gravedad', 'Hidroponia'])
  sistemaRiego?: string;

  @ApiPropertyOptional({ example: '5x5' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  marcoPlantacion?: string;

  @ApiPropertyOptional({ example: 'Plantas injertadas en patrón Duke 7' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class UpdateCultivoDto {
  @ApiPropertyOptional({ example: 'Palta' })
  @IsOptional()
  @IsString()
  @IsIn(['Palta', 'Uva', 'Arandano', 'Citricos', 'Otros'])
  cultivo?: string;

  @ApiPropertyOptional({ example: 'Hass' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  variedad?: string;

  @ApiPropertyOptional({ example: 500 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  cantidadPlantas?: number;

  @ApiPropertyOptional({ example: 3.5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  edadPromedioAnios?: number;

  @ApiPropertyOptional({ example: '2020-03-15' })
  @IsOptional()
  @IsDateString()
  fechaSiembra?: string;

  @ApiPropertyOptional({ example: 'Goteo' })
  @IsOptional()
  @IsString()
  @IsIn(['Goteo', 'Aspersion', 'Gravedad', 'Hidroponia'])
  sistemaRiego?: string;

  @ApiPropertyOptional({ example: '5x5' })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  marcoPlantacion?: string;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @ApiPropertyOptional({ example: 'Observaciones actualizadas' })
  @IsOptional()
  @IsString()
  observaciones?: string;
}

export class CultivoQueryDto {
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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  activo?: boolean;
}