import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SupplierComparisonController } from './supplier-comparison.controller';
import { SupplierComparisonService } from './supplier-comparison.service';

/** Comparador de precios entre proveedores (HU-12). Lee las tablas de HU-02; no guarda nada. */
@Module({
  imports: [PrismaModule],
  controllers: [SupplierComparisonController],
  providers: [SupplierComparisonService],
  exports: [SupplierComparisonService],
})
export class SupplierComparisonModule {}
