import { Module } from '@nestjs/common';
import { RiegosController } from './riegos.controller';
import { RiegosService } from './riegos.service';
import { PrismaModule } from '../../config/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RiegosController],
  providers: [RiegosService],
  exports: [RiegosService],
})
export class RiegosModule {}