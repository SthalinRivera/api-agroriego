import { Body, Controller, Delete, NotFoundException, ForbiddenException, Get, Module, Param, ParseUUIDPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { IsEmail, IsIn, IsNumber, IsBoolean, IsObject, IsInt, IsOptional, IsString, IsUUID, Length, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { PrismaService } from '../../config/prisma/prisma.service';
import { SupabaseAuthGuard } from '../../common/guards/supabase-auth.guard';
import { parcelaAccess } from '../../common/shared/parcela-access';

export class GestionQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 20;
  @IsOptional() @IsUUID() parcelaId?: string;
  @IsOptional() @IsUUID() dispositivoId?: string;
}
export class UpdateMiPerfilDto {
  @IsOptional() @IsString() @Length(1, 200) fullName?: string;
  @IsOptional() @IsString() @Length(0, 30) telefono?: string;
}
export class UpdateUsuarioDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) roleId?: number;
  @IsOptional() @IsBoolean() activo?: boolean;
}
export class UpsertSistemaDto {
  @IsString() @Length(1, 100) clave!: string;
  @IsObject() valor!: Record<string, unknown>;
  @IsOptional() @IsString() descripcion?: string;
}
export class CreateAccesoDto {
  @IsUUID() parcelaId!: string;
  @IsEmail() usuarioEmail!: string;
  @IsIn(['admin', 'editor', 'tecnico', 'lector']) nivelAcceso!: string;
}
export class UpdateAccesoDto {
  @IsIn(['admin', 'editor', 'tecnico', 'lector']) nivelAcceso!: string;
}
export class CreateEvaluacionDto {
  @IsUUID() prediccionId!: string;
  @Type(() => Number) @IsNumber() @Min(0) @Max(100) humedadObservada!: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) tiempoObservadoHoras?: number;
  @IsOptional() @Type(() => Number) @IsNumber() @Min(0) volumenObservadoLitros?: number;
  @IsOptional() @IsString() observaciones?: string;
}
type UserRequest = { user: { id: string } };

@Controller('gestion')
@UseGuards(SupabaseAuthGuard)
export class GestionController {
  constructor(private readonly prisma: PrismaService) {}

  private async page<T>(query: GestionQueryDto, find: (skip: number, take: number) => Promise<T[]>, count: () => Promise<number>) {
    const { page = 1, limit = 20 } = query;
    const [data, total] = await Promise.all([find((page - 1) * limit, limit), count()]);
    return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }


  private async requireAdmin(userId: string) {
    const profile = await this.prisma.profiles.findUnique({ where: { id: userId }, select: { activo: true, roles: { select: { codigo: true } } } });
    if (!profile?.activo || profile.roles.codigo !== 'admin') throw new ForbiddenException('Esta función requiere el rol administrador');
  }

  @Get('roles')
  roles() {
    return this.prisma.roles.findMany({ orderBy: { id: 'asc' } });
  }

  @Get('usuarios')
  async usuarios(@Query() query: GestionQueryDto, @Req() req: UserRequest) {
    await this.requireAdmin(req.user.id);
    return this.page(query, (skip, take) => this.prisma.profiles.findMany({ skip, take, orderBy: { created_at: 'desc' }, select: { id: true, full_name: true, telefono: true, role_id: true, activo: true, created_at: true, roles: { select: { nombre: true } } } }), () => this.prisma.profiles.count());
  }

  @Get('usuarios/:id')
  async usuario(@Param('id', ParseUUIDPipe) id: string, @Req() req: UserRequest) {
    await this.requireAdmin(req.user.id);
    return this.prisma.profiles.findUnique({ where: { id }, select: { id: true, full_name: true, role_id: true, activo: true } });
  }

  @Put('usuarios/:id')
  async actualizarUsuario(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUsuarioDto, @Req() req: UserRequest) {
    await this.requireAdmin(req.user.id);
    if (id === req.user.id) throw new ForbiddenException('No puedes cambiar tus propios permisos desde esta pantalla');
    return this.prisma.profiles.update({ where: { id }, data: { role_id: dto.roleId, activo: dto.activo, updated_at: new Date() }, select: { id: true, activo: true, role_id: true } });
  }

  @Get('sistema')
  async sistema(@Req() req: UserRequest) {
    await this.requireAdmin(req.user.id);
    return this.prisma.configuracion_sistema.findMany({ orderBy: { clave: 'asc' } });
  }

  @Post('sistema')
  async guardarSistema(@Body() dto: UpsertSistemaDto, @Req() req: UserRequest) {
    await this.requireAdmin(req.user.id);
    const data = { valor: dto.valor as import('@prisma/client').Prisma.InputJsonObject, descripcion: dto.descripcion, updated_by: req.user.id, updated_at: new Date() };
    return this.prisma.configuracion_sistema.upsert({ where: { clave: dto.clave }, create: { clave: dto.clave, ...data }, update: data });
  }


  private async requireOwner(parcelaId: string, userId: string) {
    const parcela = await this.prisma.parcelas.findFirst({ where: { id: parcelaId, propietario_id: userId }, select: { id: true } });
    if (!parcela) throw new ForbiddenException('Solo el propietario puede gestionar accesos');
  }

  @Post('accesos')
  async compartir(@Body() dto: CreateAccesoDto, @Req() req: UserRequest) {
    await this.requireOwner(dto.parcelaId, req.user.id);
    const profile = await this.prisma.profiles.findFirst({ where: { activo: true, users: { is: { email: { equals: dto.usuarioEmail.trim(), mode: 'insensitive' } } } }, select: { id: true } });
    if (!profile) throw new NotFoundException('No existe una cuenta activa con ese correo');
    if (profile.id === req.user.id) throw new ForbiddenException('El propietario ya tiene acceso');
    return this.prisma.parcela_usuarios.upsert({ where: { parcela_id_usuario_id: { parcela_id: dto.parcelaId, usuario_id: profile.id } }, create: { parcela_id: dto.parcelaId, usuario_id: profile.id, nivel_acceso: dto.nivelAcceso }, update: { nivel_acceso: dto.nivelAcceso } });
  }

  @Get('accesos/:id')
  async acceso(@Param('id', ParseUUIDPipe) id: string, @Req() req: UserRequest) {
    const record = await this.prisma.parcela_usuarios.findUnique({ where: { id } });
    if (!record) throw new NotFoundException();
    await this.requireOwner(record.parcela_id, req.user.id);
    return record;
  }

  @Put('accesos/:id')
  async editarAcceso(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateAccesoDto, @Req() req: UserRequest) {
    await this.acceso(id, req);
    return this.prisma.parcela_usuarios.update({ where: { id }, data: { nivel_acceso: dto.nivelAcceso } });
  }

  @Delete('accesos/:id')
  async quitarAcceso(@Param('id', ParseUUIDPipe) id: string, @Req() req: UserRequest) {
    await this.acceso(id, req);
    return this.prisma.parcela_usuarios.delete({ where: { id } });
  }

  @Post('evaluaciones')
  async evaluar(@Body() dto: CreateEvaluacionDto, @Req() req: UserRequest) {
    const prediction = await this.prisma.predicciones.findFirst({ where: { id: dto.prediccionId, parcelas: parcelaAccess(req.user.id) } });
    if (!prediction) throw new NotFoundException('Predicción no encontrada o sin acceso');
    const predicted = prediction.humedad_predicha == null ? null : Number(prediction.humedad_predicha);
    const absolute = predicted === null ? null : Math.abs(dto.humedadObservada - predicted);
    return this.prisma.evaluaciones_prediccion.create({ data: {
      prediccion_id: prediction.id, humedad_observada: dto.humedadObservada, humedad_predicha: prediction.humedad_predicha,
      tiempo_observado_horas: dto.tiempoObservadoHoras, tiempo_predicho_horas: prediction.tiempo_riego_horas,
      volumen_observado_litros: dto.volumenObservadoLitros, volumen_predicho_litros: prediction.volumen_riego_litros,
      error_absoluto: absolute, error_porcentual: absolute === null || dto.humedadObservada === 0 ? null : absolute / dto.humedadObservada * 100,
      observaciones: dto.observaciones,
    } });
  }

  @Get('eventos')
  eventos(@Query() query: GestionQueryDto, @Req() req: UserRequest) {
    const where = { dispositivos: { parcelas: { ...parcelaAccess(req.user.id), ...(query.parcelaId ? { id: query.parcelaId } : {}) } }, ...(query.dispositivoId ? { dispositivo_id: query.dispositivoId } : {}) };
    return this.page(query, (skip, take) => this.prisma.device_logs.findMany({ where, skip, take, orderBy: { created_at: 'desc' }, select: { id: true, nivel: true, codigo: true, mensaje: true, created_at: true, dispositivos: { select: { nombre: true } } } }), () => this.prisma.device_logs.count({ where }));
  }

  @Get('evaluaciones')
  evaluaciones(@Query() query: GestionQueryDto, @Req() req: UserRequest) {
    const where = { predicciones: { parcelas: { ...parcelaAccess(req.user.id), ...(query.parcelaId ? { id: query.parcelaId } : {}) } } };
    return this.page(query, (skip, take) => this.prisma.evaluaciones_prediccion.findMany({ where, skip, take, orderBy: { evaluated_at: 'desc' }, include: { predicciones: { select: { parcelas: { select: { nombre: true } } } } } }), () => this.prisma.evaluaciones_prediccion.count({ where }));
  }

  @Get('accesos')
  accesos(@Query() query: GestionQueryDto, @Req() req: UserRequest) {
    // Owners can inspect their team's access. Members only see their own membership.
    const where = { OR: [{ parcelas: { propietario_id: req.user.id } }, { usuario_id: req.user.id }], ...(query.parcelaId ? { parcela_id: query.parcelaId } : {}) };
    return this.page(query, (skip, take) => this.prisma.parcela_usuarios.findMany({ where, skip, take, orderBy: { created_at: 'desc' }, include: { parcelas: { select: { nombre: true } }, profiles: { select: { full_name: true } } } }), () => this.prisma.parcela_usuarios.count({ where }));
  }

  @Get('auditoria')
  auditoria(@Query() query: GestionQueryDto, @Req() req: UserRequest) {
    const where = { usuario_id: req.user.id };
    // Do not return raw before/after payloads: they can contain credentials.
    return this.page(query, (skip, take) => this.prisma.auditoria.findMany({ where, skip, take, orderBy: { created_at: 'desc' }, select: { id: true, accion: true, entidad: true, entidad_id: true, descripcion: true, created_at: true } }), () => this.prisma.auditoria.count({ where }));
  }

  @Get('dispositivos-push')
  dispositivosPush(@Query() query: GestionQueryDto, @Req() req: UserRequest) {
    const where = { usuario_id: req.user.id };
    return this.page(query, (skip, take) => this.prisma.user_devices.findMany({ where, skip, take, orderBy: { created_at: 'desc' }, select: { id: true, plataforma: true, modelo_dispositivo: true, app_version: true, activo: true, last_seen: true, created_at: true } }), () => this.prisma.user_devices.count({ where }));
  }

  @Put('dispositivos-push/:id/desactivar')
  desactivarPush(@Param('id', ParseUUIDPipe) id: string, @Req() req: UserRequest) {
    return this.prisma.user_devices.updateMany({ where: { id, usuario_id: req.user.id }, data: { activo: false, updated_at: new Date() } });
  }

  @Get('perfil')
  perfil(@Req() req: UserRequest) {
    return this.prisma.profiles.findUnique({ where: { id: req.user.id }, select: { id: true, full_name: true, telefono: true, activo: true, last_login_at: true, created_at: true, roles: { select: { nombre: true, descripcion: true } } } });
  }

  @Get('perfil/:id')
  perfilPorId(@Param('id', ParseUUIDPipe) id: string, @Req() req: UserRequest) {
    if (id !== req.user.id) throw new ForbiddenException();
    return this.perfil(req);
  }

  @Put('perfil/:id')
  actualizarPerfil(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateMiPerfilDto, @Req() req: UserRequest) {
    if (id !== req.user.id) throw new ForbiddenException();
    return this.prisma.profiles.update({ where: { id: req.user.id }, data: { full_name: dto.fullName, telefono: dto.telefono, updated_at: new Date() }, select: { id: true, full_name: true, telefono: true } });
  }
}

@Module({ controllers: [GestionController] })
export class GestionModule {}
