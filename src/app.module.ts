import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';          // ← 1. importar
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { ParcelasModule } from './modules/parcelas/parcelas.module';
import { DispositivosModule } from './modules/dispositivos/dispositivos.module';
import { SensoresModule } from './modules/sensores/sensores.module';
import { LecturasModule } from './modules/lecturas/lecturas.module';
import { AlertasModule } from './modules/alertas/alertas.module';
import { PrediccionesModule } from './modules/predicciones/predicciones.module';
import { CultivosModule } from './modules/cultivos/cultivos.module';
import { RiegosModule } from './modules/riegos/riegos.module';
import { NotificacionesModule } from './modules/notificaciones/notificaciones.module';
import { ConfiguracionAlertasModule } from './modules/configuracion-alertas/configuracion-alertas.module';
import { ModelosIAModule } from './modules/modelos-ia/modelos-ia.module';
import { ReportesModule } from './modules/reportes/reportes.module';

@Module({
  imports: [
    ConfigModule.forRoot({          // ← 2. PRIMERO, antes que todo
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    AuthModule,
    ParcelasModule,
    DispositivosModule,
    SensoresModule,
    LecturasModule,
    AlertasModule,
    PrediccionesModule,
    CultivosModule,
    RiegosModule,
    NotificacionesModule,
    ConfiguracionAlertasModule,
    ModelosIAModule,
    ReportesModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }