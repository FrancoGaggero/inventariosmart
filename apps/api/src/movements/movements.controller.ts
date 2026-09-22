import {
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';
import {
  type Anulacion,
  AnulacionSchema,
  type ListaMovimientos,
  type Movimiento,
  type MovimientoCreate,
  MovimientoCreateSchema,
  type MovimientosQuery,
  MovimientosQuerySchema,
  TIPOS_MOVIMIENTO,
} from '@inventariosmart/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { validacion } from '../common/errors';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AnulacionBodyDto,
  ListaMovimientosDto,
  MovimientoCreateBodyDto,
  MovimientoDto,
} from './movements.dto';
import { MovementsService } from './movements.service';

const CLAVE_IDEMPOTENCIA_MAX = 64;

@ApiTags('movimientos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Rol sin permiso (SIN_PERMISO)' })
@Roles('DUENIO', 'EMPLEADO', 'CONTADOR')
@Controller('movements')
export class MovementsController {
  constructor(private readonly movements: MovementsService) {}

  @Get()
  @ApiOperation({
    summary: 'Historial de movimientos del comercio',
    description:
      'Del más reciente al más antiguo, con filtros por producto, tipo y rango de fechas, y paginación por cursor. CONTADOR sólo consulta.',
  })
  @ApiQuery({ name: 'productoId', required: false, format: 'uuid' })
  @ApiQuery({ name: 'tipo', required: false, enum: TIPOS_MOVIMIENTO })
  @ApiQuery({ name: 'desde', required: false, description: 'ISO 8601, inclusive' })
  @ApiQuery({ name: 'hasta', required: false, description: 'ISO 8601, inclusive' })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: 'siguienteCursor de la página anterior',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  @ApiOkResponse({ type: ListaMovimientosDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Parámetros, fechas o cursor inválidos',
  })
  listar(
    @Query(new ZodValidationPipe(MovimientosQuerySchema)) query: MovimientosQuery,
  ): Promise<ListaMovimientos> {
    return this.movements.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un movimiento' })
  @ApiOkResponse({ type: MovimientoDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  obtener(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<Movimiento> {
    return this.movements.obtener(id);
  }

  @Post()
  @Roles('DUENIO', 'EMPLEADO')
  @ApiOperation({
    summary: 'Registrar una venta, un ingreso o un ajuste',
    description:
      'Actualiza el stock del producto en la misma transacción; el stock nunca queda negativo (409). Con Idempotency-Key, repetir la misma clave devuelve 200 con el movimiento original.',
  })
  @ApiHeader({
    name: 'Idempotency-Key',
    required: false,
    description: 'Clave única por intento (hasta 64 caracteres) para no duplicar ante un reintento',
  })
  @ApiBody({ type: MovimientoCreateBodyDto })
  @ApiCreatedResponse({ type: MovimientoDto })
  @ApiOkResponse({
    type: MovimientoDto,
    description: 'Idempotency-Key repetida: movimiento ya registrado',
  })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'VALIDACION con details por campo' })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Producto inexistente en el comercio' })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description:
      'Stock insuficiente (details.stockActual, details.cantidad) o producto dado de baja',
  })
  async registrar(
    @Body(new ZodValidationPipe(MovimientoCreateSchema))
    body: MovimientoCreateBodyDto & MovimientoCreate,
    @Headers('idempotency-key') clave: string | undefined,
    @Res({ passthrough: true }) res: Response,
  ): Promise<Movimiento> {
    const claveLimpia = clave?.trim() || undefined;
    if (claveLimpia && claveLimpia.length > CLAVE_IDEMPOTENCIA_MAX) {
      throw validacion('La cabecera Idempotency-Key no es válida.', {
        'Idempotency-Key': `Debe tener hasta ${CLAVE_IDEMPOTENCIA_MAX} caracteres.`,
      });
    }
    const { movimiento, creado } = await this.movements.registrar(body, claveLimpia);
    res.status(creado ? HttpStatus.CREATED : HttpStatus.OK);
    return movimiento;
  }

  @Post(':id/anular')
  @Roles('DUENIO')
  @ApiOperation({
    summary: 'Anular un movimiento',
    description:
      'No borra nada: registra un AJUSTE inverso con motivo ANULACION que referencia al original (RN-07) y devuelve el stock al valor previo.',
  })
  @ApiBody({ type: AnulacionBodyDto, required: false })
  @ApiCreatedResponse({ type: MovimientoDto, description: 'El AJUSTE de anulación' })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Ya anulado, es una anulación, o dejaría el stock negativo',
  })
  anular(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body() body: AnulacionBodyDto | undefined,
  ): Promise<Movimiento> {
    // El cuerpo es opcional: sin body, Express entrega undefined.
    const anulacion: Anulacion = new ZodValidationPipe(AnulacionSchema).transform(body ?? {});
    return this.movements.anular(id, anulacion);
  }
}
