import { Module } from '@nestjs/common';
import { ModelosIAController } from './modelos-ia.controller';
import { ModelosIAService } from './modelos-ia.service';
import { PrismaModule } from '../../config/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ModelosIAController],
  providers: [ModelosIAService],
  exports: [ModelosIAService],
})
export class ModelosIAModule {}