import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type ComparacionProducto,
  type ComparadorQuery,
  ComparadorQuerySchema,
  type ResumenComparador,
} from '@inventariosmart/shared';
import { RequierePlan, Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ComparacionProductoDto, ResumenComparadorDto } from './supplier-comparison.dto';
import { SupplierComparisonService } from './supplier-comparison.service';

@ApiTags('comparador')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'Sólo el dueño: proveedores y costos no son para EMPLEADO ni CONTADOR',
})
@ApiPaymentRequiredResponse({
  type: ApiErrorDto,
  description: 'Planes FREE y PRO: el comparador requiere PREMIUM (PLAN_REQUERIDO)',
})
@Controller()
@RequierePlan('PREMIUM')
@Roles('DUENIO')
export class SupplierComparisonController {
  constructor(private readonly comparador: SupplierComparisonService) {}

  @Get('supplier-comparison')
  @ApiOperation({
    summary: 'Insumos con dos o más proveedores y su proveedor recomendado (HU-12)',
    description:
      'Ordenados por ahorro mensual estimado. El puntaje pondera precio (60 %), plazo (25 %) y confiabilidad (15 %) (RN-13). Se calcula al consultar con el último costo de cada proveedor activo.',
  })
  @ApiQuery({
    name: 'soloOportunidades',
    required: false,
    enum: ['true', 'false'],
    description: 'Sólo los insumos cuyo recomendado no es su proveedor principal',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Código o nombre del producto' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiOkResponse({ type: ResumenComparadorDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  resumen(
    @Query(new ZodValidationPipe(ComparadorQuerySchema)) query: ComparadorQuery,
  ): Promise<ResumenComparador> {
    return this.comparador.resumen(query);
  }

  @Get('products/:id/supplier-comparison')
  @ApiOperation({
    summary: 'Proveedores de un insumo, puntuados de mayor a menor (HU-12)',
    description:
      'Para usar al recomendado como proveedor principal se edita el producto con `PATCH /products/:id` (`proveedorPrincipalId`), que además actualiza el costo de reposición (RN-08).',
  })
  @ApiOkResponse({ type: ComparacionProductoDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  producto(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ComparacionProducto> {
    return this.comparador.producto(id);
  }
}
