import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
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
  type ListaLotes,
  type LoteRemarcacionDetalle,
  type LotesQuery,
  LotesQuerySchema,
  type RemarcacionApply,
  RemarcacionApplySchema,
  type RemarcacionPreview,
  RemarcacionPreviewSchema,
  type ResultadoReversion,
  type VistaPreviaRemarcacion,
} from '@inventariosmart/shared';
import { RequierePlan, Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ListaLotesDto,
  LoteRemarcacionDetalleDto,
  RemarcacionApplyBodyDto,
  RemarcacionPreviewBodyDto,
  ResultadoReversionDto,
  VistaPreviaRemarcacionDto,
} from './repricing.dto';
import { RepricingService } from './repricing.service';

const UUID_V4 = new ParseUUIDPipe({ version: '4' });

@ApiTags('remarcación')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'EMPLEADO sin acceso; CONTADOR sólo vista previa y lotes',
})
@ApiPaymentRequiredResponse({
  type: ApiErrorDto,
  description: 'Plan FREE: la remarcación requiere PRO (PLAN_REQUERIDO)',
})
@Controller('repricing')
@RequierePlan('PRO')
@Roles('DUENIO', 'CONTADOR')
export class RepricingController {
  constructor(private readonly repricing: RepricingService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Vista previa de una remarcación (HU-17). No modifica nada',
    description:
      'Calcula el precio nuevo de cada producto según el criterio: INFLACION y MARGEN usan los precios sugeridos de HU-15 para el período; PORCENTAJE suma un porcentaje al precio actual; MARGEN_OBJETIVO parte del costo de reposición. El redondeo es siempre hacia arriba y un precio nuevo menor al actual queda SIN_CAMBIO salvo `permitirBajas` (RN-12).',
  })
  @ApiBody({ type: RemarcacionPreviewBodyDto })
  @ApiOkResponse({ type: VistaPreviaRemarcacionDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'VALIDACION con details por campo' })
  vistaPrevia(
    @Body(new ZodValidationPipe(RemarcacionPreviewSchema)) body: RemarcacionPreview,
  ): Promise<VistaPreviaRemarcacion> {
    return this.repricing.vistaPrevia(body);
  }

  @Post('apply')
  @Roles('DUENIO')
  @ApiOperation({
    summary: 'Aplicar una remarcación en lote: todo o nada (RN-12)',
    description:
      'Recibe por producto el precio actual visto y el precio nuevo. Si el precio de algún producto cambió desde la vista previa responde 409 con `details.productos` y no aplica nada. Deja una fila en el historial de precios con origen REMARCACION y crea el lote.',
  })
  @ApiBody({ type: RemarcacionApplyBodyDto })
  @ApiCreatedResponse({ type: LoteRemarcacionDetalleDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'VALIDACION con details por campo' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Producto de otro comercio' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Algún precio cambió (CONFLICTO)' })
  aplicar(
    @Body(new ZodValidationPipe(RemarcacionApplySchema)) body: RemarcacionApply,
  ): Promise<LoteRemarcacionDetalle> {
    return this.repricing.aplicar(body);
  }

  @Get('batches')
  @ApiOperation({ summary: 'Remarcaciones del comercio, de la más reciente a la más antigua' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiOkResponse({ type: ListaLotesDto })
  listar(@Query(new ZodValidationPipe(LotesQuerySchema)) query: LotesQuery): Promise<ListaLotes> {
    return this.repricing.listar(query);
  }

  @Get('batches/:id')
  @ApiOperation({ summary: 'Detalle de una remarcación con el precio anterior y nuevo' })
  @ApiOkResponse({ type: LoteRemarcacionDetalleDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  obtener(@Param('id', UUID_V4) id: string): Promise<LoteRemarcacionDetalle> {
    return this.repricing.obtener(id);
  }

  @Post('batches/:id/revert')
  @Roles('DUENIO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Deshacer una remarcación, una sola vez (RN-12)',
    description:
      'Vuelven al precio anterior los productos que siguen con el precio remarcado. Los que cambiaron después o están dados de baja no se tocan y se informan en `productosOmitidos`.',
  })
  @ApiOkResponse({ type: ResultadoReversionDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'La remarcación ya se deshizo' })
  deshacer(@Param('id', UUID_V4) id: string): Promise<ResultadoReversion> {
    return this.repricing.deshacer(id);
  }
}
