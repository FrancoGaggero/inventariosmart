import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { ProfitabilityController } from './profitability.controller';
import { ProfitabilityService } from './profitability.service';

/** HU-03: motor de rentabilidad. Consume el prorrateo de gastos de HU-13; lo exporta para HU-04. */
@Module({
  imports: [ExpensesModule],
  controllers: [ProfitabilityController],
  providers: [ProfitabilityService],
  exports: [ProfitabilityService],
})
export class ProfitabilityModule {}
