import { Module } from '@nestjs/common';
import { InsightsModule } from '../insights/insights.module';
import { PrismaModule } from '../prisma/prisma.module';
import { RepricingController } from './repricing.controller';
import { RepricingService } from './repricing.service';

/** Remarcación asistida (HU-17). Usa los precios sugeridos de HU-15 y el historial de precios. */
@Module({
  imports: [PrismaModule, InsightsModule],
  controllers: [RepricingController],
  providers: [RepricingService],
})
export class RepricingModule {}
