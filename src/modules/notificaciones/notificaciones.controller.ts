import { NotificationTestService } from './notification-test.service';
import { Controller, Get, Put, Post, Body, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { NotificacionesService } from './notificaciones.service';
import { NotificacionQueryDto, MarcarLeidaDto } from './notificaciones.dto';

@ApiTags('Notificaciones')
@ApiBearerAuth()
@Controller('notificaciones')
@UseGuards(SupabaseAuthGuard)
export class NotificacionesController {
  constructor(private readonly notificacionesService: NotificacionesService, private readonly notificationTest: NotificationTestService) {}

  @Post('prueba')
  @ApiOperation({ summary: 'Enviar una notificación de prueba a mis dispositivos' })
  async sendTest(@Req() req: any) {
    return this.notificationTest.send(req.user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Listar notificaciones del usuario' })
  async findAll(@Query() query: NotificacionQueryDto, @Req() req: any) {
    return this.notificacionesService.findAll(query, req.user.id);
  }

  @Get('no-leidas/count')
  @ApiOperation({ summary: 'Obtener cantidad de notificaciones no leídas' })
  async getNoLeidasCount(@Req() req: any) {
    return this.notificacionesService.getNoLeidasCount(req.user.id);
  }

  @Put(':id/leer')
  @ApiOperation({ summary: 'Marcar notificación como leída/no leída' })
  async marcarComoLeida(@Param('id') id: string, @Body() dto: MarcarLeidaDto, @Req() req: any) {
    return this.notificacionesService.marcarComoLeida(id, req.user.id, dto);
  }

  @Put('leer-todas')
  @ApiOperation({ summary: 'Marcar todas las notificaciones como leídas' })
  async marcarTodasComoLeidas(@Req() req: any) {
    return this.notificacionesService.marcarTodasComoLeidas(req.user.id);
  }
}