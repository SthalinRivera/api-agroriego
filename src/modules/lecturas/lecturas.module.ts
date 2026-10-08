import { Module } from '@nestjs/common';
import { LecturasController } from './lecturas.controller';
import { LecturasService } from './lecturas.service';
import { PrismaModule } from '../../config/prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [LecturasController],
  providers: [LecturasService],
  exports: [LecturasService],
})
export class LecturasModule {}