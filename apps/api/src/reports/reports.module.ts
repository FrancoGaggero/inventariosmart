import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfitabilityModule } from '../profitability/profitability.module';
import { ReportsController } from './reports.controller';
import { ReportsCron } from './reports.cron';
import { ReportsService } from './reports.service';

/** Reportes semanales de rentabilidad (HU-09). Compone HU-03, HU-13 y HU-06; correo de HU-06. */
@Module({
  imports: [PrismaModule, ProfitabilityModule, AlertsModule],
  controllers: [ReportsController],
  providers: [ReportsService, ReportsCron],
  exports: [ReportsService],
})
export class ReportsModule {}
