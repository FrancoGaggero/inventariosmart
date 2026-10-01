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
  type ListaQuiebres,
  type StockoutsQuery,
  StockoutsQuerySchema,
} from '@inventariosmart/shared';
import { RequierePlan, Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ListaQuiebresDto } from './stockouts.dto';
import { StockoutsService } from './stockouts.service';

@ApiTags('quiebres')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'El EMPLEADO no ve márgenes (SIN_PERMISO)',
})
@ApiPaymentRequiredResponse({
  type: ApiErrorDto,
  description: 'Plan FREE: requiere PRO (PLAN_REQUERIDO)',
})
@Controller('stockouts')
@RequierePlan('PRO')
@Roles('DUENIO', 'CONTADOR')
export class StockoutsController {
  constructor(private readonly stockouts: StockoutsService) {}

  @Get()
  @ApiOperation({
    summary: 'Pérdidas por falta de stock en los últimos 30, 60 o 90 días (HU-18)',
    description:
      'RN-14: un quiebre es el tiempo en que un producto activo estuvo en 0, reconstruido con el stock que dejó cada movimiento. La pérdida se estima con lo que el producto vendía en los días con stock de los últimos 90 días. Ordenado por ganancia perdida; los no calculables, al final.',
  })
  @ApiQuery({ name: 'dias', required: false, enum: [30, 60, 90], example: 30 })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiOkResponse({ type: ListaQuiebresDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  listar(
    @Query(new ZodValidationPipe(StockoutsQuerySchema)) query: StockoutsQuery,
  ): Promise<ListaQuiebres> {
    return this.stockouts.listar(query);
  }
}
