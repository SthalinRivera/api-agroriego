import { Module } from '@nestjs/common';
import { SensoresController } from './sensores.controller';
import { SensoresService } from './sensores.service';
import { PrismaModule } from '../../config/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [SensoresController],
  providers: [SensoresService],
  exports: [SensoresService],
})
export class SensoresModule {}