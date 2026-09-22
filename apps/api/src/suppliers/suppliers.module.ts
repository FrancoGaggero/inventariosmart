import { Module } from '@nestjs/common';
import { PriceListService } from './price-list.service';
import { PricesService } from './prices.service';
import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';

/**
 * HU-02: proveedores y listas de precios. Exporta `PricesService` para que el módulo de
 * productos registre el costo manual y el cambio de proveedor principal por el mismo camino.
 */
@Module({
  controllers: [SuppliersController],
  providers: [SuppliersService, PricesService, PriceListService],
  exports: [PricesService],
})
export class SuppliersModule {}
