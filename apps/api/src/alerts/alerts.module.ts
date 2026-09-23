import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AlertsController } from './alerts.controller';
import { AlertsCron } from './alerts.cron';
import { AlertsService } from './alerts.service';
import { mailerProvider } from './mailer';

/** Alertas predictivas de reposición (HU-06). */
@Module({
  imports: [PrismaModule],
  controllers: [AlertsController],
  providers: [AlertsService, AlertsCron, mailerProvider],
  exports: [AlertsService],
})
export class AlertsModule {}
