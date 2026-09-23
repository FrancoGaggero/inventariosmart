import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  GastosQuerySchema,
  type GastosQuery,
  type ListaRentabilidad,
  type RentabilidadQuery,
  RentabilidadQuerySchema,
  type ResumenRentabilidad,
} from '@inventariosmart/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ListaRentabilidadDto, ResumenRentabilidadDto } from './profitability.dto';
import { ProfitabilityService } from './profitability.service';

@ApiTags('rentabilidad')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'EMPLEADO sin acceso: el margen es sensible',
})
@Roles('DUENIO', 'CONTADOR')
@Controller('profitability')
export class ProfitabilityController {
  constructor(private readonly profitability: ProfitabilityService) {}

  @Get('products')
  @ApiOperation({
    summary: 'Rentabilidad por producto',
    description:
      'Precio neto, margen bruto ($ y %), unidades vendidas del mes y margen neto (RN-01, RN-02, RN-03). Nada se almacena: refleja el precio, el costo y los gastos actuales.',
  })
  @ApiQuery({ name: 'periodo', required: false, example: '2026-09' })
  @ApiQuery({ name: 'q', required: false, description: 'Código (prefijo) o nombre (contiene)' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  @ApiOkResponse({ type: ListaRentabilidadDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  listar(
    @Query(new ZodValidationPipe(RentabilidadQuerySchema)) query: RentabilidadQuery,
  ): Promise<ListaRentabilidad> {
    return this.profitability.listar(query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Consolidado del mes',
    description:
      'Ventas netas, costo de lo vendido (costo vigente, RN-08), margen bruto y neto ($ y %) y gastos del mes; motivo cuando el neto no es calculable.',
  })
  @ApiQuery({ name: 'periodo', required: false, example: '2026-09' })
  @ApiOkResponse({ type: ResumenRentabilidadDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  resumen(
    @Query(new ZodValidationPipe(GastosQuerySchema)) query: GastosQuery,
  ): Promise<ResumenRentabilidad> {
    return this.profitability.resumen(query.periodo);
  }
}
