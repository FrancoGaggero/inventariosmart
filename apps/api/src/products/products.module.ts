import { Module } from '@nestjs/common';
import { MovementsModule } from '../movements/movements.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [MovementsModule, SuppliersModule],
  controllers: [ProductsController],
  providers: [ProductsService],
  exports: [ProductsService],
})
export class ProductsModule {}
