import { Body, Controller, Get, HttpCode, HttpStatus, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type CambioPlan,
  CambioPlanSchema,
  type HistorialPlan,
  type HistorialPlanQuery,
  HistorialPlanQuerySchema,
  type PlanDetalle,
} from '@inventariosmart/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { CambioPlanBodyDto, HistorialPlanDto, PlanDetalleDto } from './plans.dto';
import { PlansService } from './plans.service';

@ApiTags('plan')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@Controller('plan')
export class PlansController {
  constructor(private readonly plans: PlansService) {}

  @Get()
  @Roles('DUENIO', 'EMPLEADO', 'CONTADOR')
  @ApiOperation({
    summary: 'Plan vigente, funcionalidades y uso contra los límites (HU-14)',
    description:
      'Disponible en todos los planes y para todos los roles. El `planMinimo` de cada funcionalidad es el mismo que informa el 402 `PLAN_REQUERIDO` de sus rutas.',
  })
  @ApiOkResponse({ type: PlanDetalleDto })
  obtener(): Promise<PlanDetalle> {
    return this.plans.obtener();
  }

  @Post('change')
  @HttpCode(HttpStatus.OK)
  @Roles('DUENIO')
  @ApiOperation({
    summary: 'Cambiar el plan del comercio (HU-14)',
    description:
      'Rige desde el pedido siguiente, sin cerrar sesión, y no tiene cobro. Bajar de plan no borra datos. Para bajar a FREE el comercio tiene que entrar en sus límites de productos y usuarios activos.',
  })
  @ApiBody({ type: CambioPlanBodyDto })
  @ApiOkResponse({ type: PlanDetalleDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Sólo el dueño cambia el plan' })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      '`details.motivo`: `MISMO_PLAN` o `SUPERA_LIMITES`, con `details.excesos` (recurso, cantidad y límite)',
  })
  cambiar(@Body(new ZodValidationPipe(CambioPlanSchema)) dto: CambioPlan): Promise<PlanDetalle> {
    return this.plans.cambiar(dto);
  }

  @Get('history')
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Cambios de plan del comercio, del más reciente al más antiguo' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiOkResponse({ type: HistorialPlanDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  historial(
    @Query(new ZodValidationPipe(HistorialPlanQuerySchema)) query: HistorialPlanQuery,
  ): Promise<HistorialPlan> {
    return this.plans.historial(query);
  }
}
