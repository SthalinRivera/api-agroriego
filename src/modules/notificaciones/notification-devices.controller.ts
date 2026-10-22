import { Body, Controller, Put, Req, UseGuards } from '@nestjs/common';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { PrismaService } from '../../config/prisma/prisma.service';
import { RegisterDeviceDto, UnregisterDeviceDto } from './device.dto';
@Controller('notificaciones/dispositivos')
@UseGuards(SupabaseAuthGuard)
export class NotificationDevicesController {
  constructor(private readonly prisma: PrismaService) {}
  @Put()
  async register(@Body() dto: RegisterDeviceDto, @Req() req: any) {
    await this.prisma.$transaction(async tx => {
      if (dto.previousToken && dto.previousToken !== dto.token) {
        await tx.user_devices.updateMany({ where: { usuario_id: req.user.id, fcm_token: dto.previousToken }, data: { activo: false, updated_at: new Date() } });
      }
      await tx.user_devices.upsert({ where: { fcm_token: dto.token },
        create: { usuario_id: req.user.id, fcm_token: dto.token, plataforma: dto.plataforma, last_seen: new Date() },
        update: { usuario_id: req.user.id, plataforma: dto.plataforma, activo: true, last_seen: new Date(), updated_at: new Date() },
      });
    });
    return { registered: true };
  }
  @Put('desactivar')
  async unregister(@Body() dto: UnregisterDeviceDto, @Req() req: any) {
    await this.prisma.user_devices.updateMany({ where: { usuario_id: req.user.id, fcm_token: dto.token }, data: { activo: false, updated_at: new Date() } });
    return { registered: false };
  }
}
