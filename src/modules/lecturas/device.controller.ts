import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LecturasService } from './lecturas.service';
import { DeviceLecturaDto } from './device-lectura.dto';

@ApiTags('Device') // Etiqueta para Swagger
@Controller('device') // 👈 Esta es la ruta base: /device
export class DeviceController {
    constructor(private readonly lecturasService: LecturasService) { }

    @Post('lecturas') // 👈 Ruta final: POST /device/lecturas
    @ApiOperation({ summary: 'Recibir lecturas desde el ESP32 (Wokwi)' })
    async recibirLecturas(@Body() dto: DeviceLecturaDto) {
        // IMPORTANTE: No usamos @UseGuards aquí porque el ESP32 no tiene un JWT de Supabase
        return this.lecturasService.createFromDevice(dto);
    }
}