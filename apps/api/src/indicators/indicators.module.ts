import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { FUENTES_INDICADORES, fuentesProvider } from './fuentes';
import { IndicatorsController } from './indicators.controller';
import { IndicatorsCron } from './indicators.cron';
import { IndicatorsService } from './indicators.service';

/** Indicadores económicos oficiales del INDEC y del BCRA (HU-15, RNF-08). */
@Module({
  imports: [PrismaModule],
  controllers: [IndicatorsController],
  providers: [IndicatorsService, IndicatorsCron, fuentesProvider],
  exports: [IndicatorsService, FUENTES_INDICADORES],
})
export class IndicatorsModule {}
