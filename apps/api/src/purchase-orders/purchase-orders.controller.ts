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
  ESTADOS_ORDEN,
  type ListaOrdenes,
  type OrdenCompra,
  type OrdenCreate,
  OrdenCreateSchema,
  type OrdenPatch,
  OrdenPatchSchema,
  type OrdenesQuery,
  OrdenesQuerySchema,
  SEVERIDADES_SUGERENCIA,
  type SugerenciaOrdenes,
  type SugerenciaQuery,
  SugerenciaQuerySchema,
} from '@inventariosmart/shared';
import { RequierePlan, Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ListaOrdenesDto,
  OrdenCompraDto,
  OrdenCreateBodyDto,
  OrdenPatchBodyDto,
  SugerenciaOrdenesDto,
} from './purchase-orders.dto';
import { PurchaseOrdersService } from './purchase-orders.service';

const UUID_V4 = new ParseUUIDPipe({ version: '4' });

@ApiTags('ordenes-de-compra')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'EMPLEADO sin acceso; CONTADOR sólo lectura',
})
@ApiPaymentRequiredResponse({
  type: ApiErrorDto,
  description: 'Plan FREE: las órdenes requieren PRO (PLAN_REQUERIDO)',
})
@Controller('purchase-orders')
@RequierePlan('PRO')
@Roles('DUENIO', 'CONTADOR')
export class PurchaseOrdersController {
  constructor(private readonly ordenes: PurchaseOrdersService) {}

  @Get('suggest')
  @ApiOperation({
    summary: 'Sugerencia de órdenes por proveedor más conveniente (HU-07 criterio 1)',
    description:
      'Agrupa las alertas ACTIVA (CRITICA por defecto) por el proveedor de menor costo vigente; a igual costo, menor lead time y mayor confiabilidad; sin precios, el proveedor principal. Sólo lectura: no crea ni envía nada (RN-06).',
  })
  @ApiQuery({ name: 'severidad', required: false, enum: SEVERIDADES_SUGERENCIA })
  @ApiOkResponse({ type: SugerenciaOrdenesDto })
  sugerir(
    @Query(new ZodValidationPipe(SugerenciaQuerySchema)) query: SugerenciaQuery,
  ): Promise<SugerenciaOrdenes> {
    return this.ordenes.sugerir(query);
  }

  @Get()
  @ApiOperation({ summary: 'Órdenes del comercio, de la más reciente a la más antigua' })
  @ApiQuery({ name: 'estado', required: false, enum: [...ESTADOS_ORDEN, 'TODAS'] })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiOkResponse({ type: ListaOrdenesDto })
  listar(
    @Query(new ZodValidationPipe(OrdenesQuerySchema)) query: OrdenesQuery,
  ): Promise<ListaOrdenes> {
    return this.ordenes.listar(query);
  }

  @Post()
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Crear un borrador con el texto redactado automáticamente' })
  @ApiBody({ type: OrdenCreateBodyDto })
  @ApiCreatedResponse({ type: OrdenCompraDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'VALIDACION con details por campo' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Proveedor o producto de otro comercio' })
  crear(@Body(new ZodValidationPipe(OrdenCreateSchema)) body: OrdenCreate): Promise<OrdenCompra> {
    return this.ordenes.crear(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle con ítems, texto y datos de confirmación y envío' })
  @ApiOkResponse({ type: OrdenCompraDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  obtener(@Param('id', UUID_V4) id: string): Promise<OrdenCompra> {
    return this.ordenes.obtener(id);
  }

  @Patch(':id')
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Editar un borrador: proveedor, ítems, notas, asunto y texto' })
  @ApiBody({ type: OrdenPatchBodyDto })
  @ApiOkResponse({ type: OrdenCompraDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'La orden ya no está en BORRADOR' })
  editar(
    @Param('id', UUID_V4) id: string,
    @Body(new ZodValidationPipe(OrdenPatchSchema)) body: OrdenPatch,
  ): Promise<OrdenCompra> {
    return this.ordenes.editar(id, body);
  }

  @Post(':id/confirm')
  @Roles('DUENIO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirmar con un clic (RN-06): atiende las alertas y envía el correo al proveedor',
    description:
      'Con email del proveedor queda ENVIADA; sin email o con envío rechazado queda CONFIRMADA con motivoNoEnvio y el texto listo para copiar.',
  })
  @ApiOkResponse({ type: OrdenCompraDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'La orden ya fue confirmada o cancelada' })
  confirmar(@Param('id', UUID_V4) id: string): Promise<OrdenCompra> {
    return this.ordenes.confirmar(id);
  }

  @Post(':id/cancel')
  @Roles('DUENIO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancelar un borrador (se conserva como CANCELADA)' })
  @ApiOkResponse({ type: OrdenCompraDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Sólo se cancela un BORRADOR' })
  cancelar(@Param('id', UUID_V4) id: string): Promise<OrdenCompra> {
    return this.ordenes.cancelar(id);
  }
}
