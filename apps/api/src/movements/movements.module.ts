import { Module } from '@nestjs/common';
import { MovementsController } from './movements.controller';
import { MovementsService } from './movements.service';

/** HU-10: movimientos de stock. Exporta el servicio para que el alta de producto registre el stock inicial. */
@Module({
  controllers: [MovementsController],
  providers: [MovementsService],
  exports: [MovementsService],
})
export class MovementsModule {}
