import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

/** Gestión de plan y suscripción (HU-14). */
@Module({
  imports: [PrismaModule],
  controllers: [PlansController],
  providers: [PlansService],
})
export class PlansModule {}
