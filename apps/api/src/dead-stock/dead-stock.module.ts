import { Module } from '@nestjs/common';
import { relojProvider } from '../common/reloj';
import { PrismaModule } from '../prisma/prisma.module';
import { DeadStockController } from './dead-stock.controller';
import { DeadStockService } from './dead-stock.service';

/** Stock parado (HU-19). Lee producto y movimiento; no guarda nada. */
@Module({
  imports: [PrismaModule],
  controllers: [DeadStockController],
  providers: [DeadStockService, relojProvider],
  exports: [DeadStockService],
})
export class DeadStockModule {}
