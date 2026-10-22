import { NotificationTestService } from './notification-test.service';
import { FcmService } from './fcm.service';
import { NotificationWorker } from './notification-worker.service';
import { NotificationDevicesController } from './notification-devices.controller';
import { Module } from '@nestjs/common';
import { NotificacionesController } from './notificaciones.controller';
import { NotificacionesService } from './notificaciones.service';
import { PrismaModule } from '../../config/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [NotificacionesController, NotificationDevicesController],
  providers: [NotificationTestService, NotificacionesService, FcmService, NotificationWorker],
  exports: [NotificacionesService],
})
export class NotificacionesModule {}