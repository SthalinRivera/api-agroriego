import { AutomaticFichasService } from './fichas.automatic';
import { Module } from '@nestjs/common';
import { PrismaModule } from '../../config/prisma/prisma.module';
import { FichasController } from './fichas.controller';
import { FichasService } from './fichas.service';
@Module({
  imports: [PrismaModule],
  controllers: [FichasController],
  providers: [FichasService, AutomaticFichasService],
})
export class FichasModule {}
