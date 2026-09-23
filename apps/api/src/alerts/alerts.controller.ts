import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
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
  type Alerta,
  type AlertaAccion,
  AlertaAccionSchema,
  type AlertasQuery,
  AlertasQuerySchema,
  ESTADOS_ALERTA,
  type ListaAlertas,
  type ResultadoRecalculo,
  type ResumenAlertas,
} from '@inventariosmart/shared';
import { RequierePlan, Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AlertaAccionBodyDto,
  AlertaDto,
  ListaAlertasDto,
  ResultadoRecalculoDto,
  ResumenAlertasDto,
} from './alerts.dto';
import { AlertsService } from './alerts.service';

const UUID_V4 = new ParseUUIDPipe({ version: '4' });

@ApiTags('alertas')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'EMPLEADO sin acceso; CONTADOR sólo lectura',
})
@ApiPaymentRequiredResponse({
  type: ApiErrorDto,
  description: 'Plan FREE: las alertas requieren PRO (PLAN_REQUERIDO)',
})
@Controller('alerts')
@RequierePlan('PRO')
@Roles('DUENIO', 'CONTADOR')
export class AlertsController {
  constructor(private readonly alerts: AlertsService) {}

  @Get()
  @ApiOperation({
    summary: 'Alertas de reposición (HU-06)',
    description:
      'Paginado por cursor, ordenado por días de cobertura. Si el último cálculo tiene más de una hora, recalcula antes de responder.',
  })
  @ApiQuery({
    name: 'estado',
    required: false,
    enum: [...ESTADOS_ALERTA, 'TODAS'],
    example: 'ACTIVA',
  })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiOkResponse({ type: ListaAlertasDto })
  listar(
    @Query(new ZodValidationPipe(AlertasQuerySchema)) query: AlertasQuery,
  ): Promise<ListaAlertas> {
    return this.alerts.listar(query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Resumen: activas, críticas, pospuestas y fecha del último cálculo' })
  @ApiOkResponse({ type: ResumenAlertasDto })
  resumen(): Promise<ResumenAlertas> {
    return this.alerts.resumen();
  }

  @Post('recalculate')
  @Roles('DUENIO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Recalcular ahora las alertas del comercio (RN-04)' })
  @ApiOkResponse({ type: ResultadoRecalculoDto })
  async recalcular(): Promise<ResultadoRecalculo> {
    const r = await this.alerts.recalcular();
    // Sin `soloSiVencido` el servicio siempre calcula; el null no ocurre.
    return (
      r ?? { creadas: 0, actualizadas: 0, resueltas: 0, calculadasEn: new Date().toISOString() }
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de una alerta' })
  @ApiOkResponse({ type: AlertaDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  obtener(@Param('id', UUID_V4) id: string): Promise<Alerta> {
    return this.alerts.obtener(id);
  }

  @Patch(':id')
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Atender (ya se pidió) o posponer 7 días una alerta abierta' })
  @ApiBody({ type: AlertaAccionBodyDto })
  @ApiOkResponse({ type: AlertaDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Acción desconocida (VALIDACION)' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'La alerta ya está cerrada (CONFLICTO)' })
  accionar(
    @Param('id', UUID_V4) id: string,
    @Body(new ZodValidationPipe(AlertaAccionSchema)) body: AlertaAccion,
  ): Promise<Alerta> {
    return this.alerts.accionar(id, body);
  }
}
