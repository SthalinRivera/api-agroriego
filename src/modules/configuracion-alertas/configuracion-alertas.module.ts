import { Module } from '@nestjs/common';
import { ConfiguracionAlertasController } from './configuracion-alertas.controller';
import { ConfiguracionAlertasService } from './configuracion-alertas.service';
import { PrismaModule } from '../../config/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ConfiguracionAlertasController],
  providers: [ConfiguracionAlertasService],
  exports: [ConfiguracionAlertasService],
})
export class ConfiguracionAlertasModule {}