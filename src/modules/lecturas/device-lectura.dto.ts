// device-lectura.dto.ts
import { IsString, IsNumber, IsNotEmpty } from 'class-validator';

export class DeviceLecturaDto {
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