import { IsInt, IsString, IsOptional, IsNumber, IsUUID, Min, Max, IsBoolean, IsDateString } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class NotificacionQueryDto {
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

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @Transform(({ value }) => value === 'true' ? true : value === 'false' ? false : value)
  @IsBoolean()
  leida?: boolean;

  @ApiPropertyOptional({ example: '2024-01-15T00:00:00Z' })
  @IsOptional()
  @IsDateString()
  desde?: string;
}

export class MarcarLeidaDto {
  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  leida?: boolean = true;
}