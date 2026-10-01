import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type ListaStockParado,
  type DeadStockQuery,
  DeadStockQuerySchema,
} from '@inventariosmart/shared';
import { RequierePlan, Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ListaStockParadoDto } from './dead-stock.dto';
import { DeadStockService } from './dead-stock.service';

@ApiTags('stock-parado')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'El EMPLEADO no ve costos (SIN_PERMISO)',
})
@ApiPaymentRequiredResponse({
  type: ApiErrorDto,
  description: 'Plan FREE: requiere PRO (PLAN_REQUERIDO)',
})
@Controller('dead-stock')
@RequierePlan('PRO')
@Roles('DUENIO', 'CONTADOR')
export class DeadStockController {
  constructor(private readonly deadStock: DeadStockService) {}

  @Get()
  @ApiOperation({
    summary: 'Productos con stock y sin ventas en los últimos 30, 60, 90 o 180 días (HU-19)',
    description:
      'RN-15: un producto activo con stock está parado si no tuvo ventas no anuladas en el período, por fecha de venta; los dados de alta dentro del período no cuentan. Capital parado = stock × costo vigente. Ordenado por capital parado.',
  })
  @ApiQuery({ name: 'dias', required: false, enum: [30, 60, 90, 180], example: 90 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiOkResponse({ type: ListaStockParadoDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  listar(
    @Query(new ZodValidationPipe(DeadStockQuerySchema)) query: DeadStockQuery,
  ): Promise<ListaStockParado> {
    return this.deadStock.listar(query);
  }
}
