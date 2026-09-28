import { Module } from '@nestjs/common';
import { IndicatorsModule } from '../indicators/indicators.module';
import { PrismaModule } from '../prisma/prisma.module';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';

/** Precios y costos propios frente a la inflación (HU-15). Usa los indicadores oficiales. */
@Module({
  imports: [PrismaModule, IndicatorsModule],
  controllers: [InsightsController],
  providers: [InsightsService],
  exports: [InsightsService],
})
export class InsightsModule {}
