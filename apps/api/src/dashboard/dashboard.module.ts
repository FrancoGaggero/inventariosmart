import { Module } from '@nestjs/common';
import { ProfitabilityModule } from '../profitability/profitability.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

/** HU-04: panel financiero. Compone HU-03 (rentabilidad, que ya incluye HU-13) y el stock de HU-01/HU-10. */
@Module({
  imports: [ProfitabilityModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
