import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';

/** HU-05: importación de productos desde planilla (vista previa y confirmación). */
@Module({
  imports: [ProductsModule],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
