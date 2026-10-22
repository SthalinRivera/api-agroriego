import { Module } from '@nestjs/common';
import { LecturasController } from './lecturas.controller';
import { LecturasService } from './lecturas.service';
import { PrismaModule } from '../../config/prisma/prisma.module';
import { DeviceController } from './device.controller'; // 👈 1. Importar

@Module({
  imports: [PrismaModule],
  controllers: [LecturasController, DeviceController],
  providers: [LecturasService],
  exports: [LecturasService],
})
export class LecturasModule { }