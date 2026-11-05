// device-lectura.dto.ts
import { IsString, IsNumber, IsNotEmpty, IsOptional, IsDateString, Matches, MaxLength } from 'class-validator';

export class DeviceLecturaDto {
    @IsOptional()
    @IsDateString()
    @Matches(/(Z|[+-]\d{2}:\d{2})$/)
    measured_at?: string;

    @IsOptional()
    @IsString()
    @MaxLength(100)
    message_id?: string;
    @IsString()
    @IsNotEmpty()
    device_uid!: string;

    @IsNumber()
    temperatura!: number;

    @IsNumber()
    humedad_ambiental!: number;

    @IsNumber()
    humedad_suelo!: number;

    @IsNumber()
    caudal!: number;
}