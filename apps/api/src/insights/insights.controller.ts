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
  type ComparacionInflacion,
  type InflacionQuery,
  InflacionQuerySchema,
} from '@inventariosmart/shared';
import { RequierePlan, Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ComparacionInflacionDto } from './insights.dto';
import { InsightsService } from './insights.service';

@ApiTags('inflación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'EMPLEADO sin acceso: no ve costos' })
@ApiPaymentRequiredResponse({
  type: ApiErrorDto,
  description: 'Plan FREE: la comparación requiere PRO (PLAN_REQUERIDO)',
})
@Controller('insights')
@RequierePlan('PRO')
@Roles('DUENIO', 'CONTADOR')
export class InsightsController {
  constructor(private readonly insights: InsightsService) {}

  @Get('inflation')
  @ApiOperation({
    summary: 'Mis precios frente a la inflación (HU-15)',
    description:
      'Series mensuales en índice base 100 de mis precios y mis costos (canasta fija ponderada por las unidades vendidas en el período) junto al IPC del INDEC, variaciones, brechas en términos reales (RN-11) y, por producto, estado y precios sugeridos. Por defecto cubre los últimos 6 meses hasta el último mes con IPC publicado.',
  })
  @ApiQuery({ name: 'desde', required: false, example: '2026-03', description: 'AAAA-MM' })
  @ApiQuery({ name: 'hasta', required: false, example: '2026-08', description: 'AAAA-MM' })
  @ApiOkResponse({ type: ComparacionInflacionDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Período inválido (VALIDACION con details por campo)',
  })
  inflacion(
    @Query(new ZodValidationPipe(InflacionQuerySchema)) query: InflacionQuery,
  ): Promise<ComparacionInflacion> {
    return this.insights.inflacion(query);
  }
}
