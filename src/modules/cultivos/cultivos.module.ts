import { Module } from '@nestjs/common';
import { CultivosController } from './cultivos.controller';
import { CultivosService } from './cultivos.service';
import { PrismaModule } from '../../config/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [CultivosController],
  providers: [CultivosService],
  exports: [CultivosService],
})
export class CultivosModule {}