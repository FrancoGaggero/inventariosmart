import { Module } from '@nestjs/common';
import { AlertsModule } from '../alerts/alerts.module';
import { DeadStockModule } from '../dead-stock/dead-stock.module';
import { ExpensesModule } from '../expenses/expenses.module';
import { IndicatorsModule } from '../indicators/indicators.module';
import { InsightsModule } from '../insights/insights.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProductsModule } from '../products/products.module';
import { ProfitabilityModule } from '../profitability/profitability.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { SupplierComparisonModule } from '../supplier-comparison/supplier-comparison.module';
import { StockoutsModule } from '../stockouts/stockouts.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { HerramientasAsistente } from './herramientas';
import { modeloProvider } from './modelo';

/** Asistente conversacional con IA (HU-08): consulta los servicios de los demás módulos. */
@Module({
  imports: [
    PrismaModule,
    ProfitabilityModule,
    ProductsModule,
    AlertsModule,
    ExpensesModule,
    InsightsModule,
    IndicatorsModule,
    SuppliersModule,
    SupplierComparisonModule,
    PurchaseOrdersModule,
    StockoutsModule,
    DeadStockModule,
  ],
  controllers: [AssistantController],
  providers: [AssistantService, HerramientasAsistente, modeloProvider],
})
export class AssistantModule {}
