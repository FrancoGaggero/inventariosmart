import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { StockoutsController } from './stockouts.controller';
import { StockoutsService, relojProvider } from './stockouts.service';

/** Pérdidas por falta de stock (HU-18). Lee movimiento y producto; no guarda nada. */
@Module({
  imports: [PrismaModule],
  controllers: [StockoutsController],
  providers: [StockoutsService, relojProvider],
  exports: [StockoutsService],
})
export class StockoutsModule {}
