// src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../config/prisma/prisma.service';

@Injectable()
export class RolesGuard implements CanActivate {
    constructor(
        private reflector: Reflector,
        private prisma: PrismaService,
    ) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const requiredRoles = this.reflector.get<string[]>('roles', context.getHandler());
        if (!requiredRoles || requiredRoles.length === 0) {
            return true; // No se requieren roles específicos
        }

        const request = context.switchToHttp().getRequest();
        const user = request.user; // Ya lo dejó el SupabaseAuthGuard

        if (!user || !user.email) {
            throw new ForbiddenException('Usuario no autenticado');
        }

        // Obtener el usuario de la BD con sus roles
        const dbUser = await this.prisma.profiles.findFirst({
            where: { users: { is: { email: user.email } }, activo: true },
            include: { roles: true },
        });

        if (!dbUser) {
            throw new ForbiddenException('Usuario no registrado en el sistema');
        }

        const userRoles = [dbUser.roles.nombre, dbUser.roles.codigo];
        const hasRole = requiredRoles.some(role => userRoles.includes(role));

        if (!hasRole) {
            throw new ForbiddenException('No tienes permiso para acceder a este recurso');
        }

        return true;
    }
}