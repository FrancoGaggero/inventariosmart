import {
  Body,
  Controller,
  Delete,
  Get,
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
  ESTADOS_STOCK,
  type ListaProductos,
  type Producto,
  type ProductoCreate,
  ProductoCreateSchema,
  type ProductoPatch,
  ProductoPatchSchema,
  type ProductosQuery,
  ProductosQuerySchema,
} from '@inventariosmart/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ListaProductosDto,
  ProductoCreateBodyDto,
  ProductoDto,
  ProductoPatchBodyDto,
} from './products.dto';
import { ProductsService } from './products.service';

@ApiTags('productos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Rol sin permiso (SIN_PERMISO)' })
@Roles('DUENIO', 'EMPLEADO')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar productos del comercio',
    description:
      'Búsqueda por código (prefijo) o nombre (contiene), filtro por estado de stock y por activo, orden alfabético y paginación por cursor. El rol EMPLEADO no recibe costoReposicion.',
  })
  @ApiQuery({ name: 'q', required: false, description: 'Texto a buscar en código o nombre' })
  @ApiQuery({ name: 'estado', required: false, enum: ESTADOS_STOCK })
  @ApiQuery({
    name: 'activo',
    required: false,
    enum: ['true', 'false'],
    description: 'Default true',
  })
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
  @ApiOkResponse({ type: ListaProductosDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Parámetros o cursor inválidos' })
  listar(
    @Query(new ZodValidationPipe(ProductosQuerySchema)) query: ProductosQuery,
  ): Promise<ListaProductos> {
    return this.products.listar(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un producto' })
  @ApiOkResponse({ type: ProductoDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  obtener(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<Producto> {
    return this.products.obtener(id);
  }

  @Post()
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Crear un producto con su stock inicial' })
  @ApiBody({ type: ProductoCreateBodyDto })
  @ApiCreatedResponse({ type: ProductoDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'VALIDACION con details por campo' })
  @ApiConflictResponse({
    type: ApiErrorDto,
    description: 'Código repetido en el comercio (CONFLICTO)',
  })
  @ApiPaymentRequiredResponse({
    type: ApiErrorDto,
    description: 'Límite de productos del plan (PLAN_REQUERIDO)',
  })
  crear(
    @Body(new ZodValidationPipe(ProductoCreateSchema)) body: ProductoCreateBodyDto & ProductoCreate,
  ): Promise<Producto> {
    return this.products.crear(body);
  }

  @Patch(':id')
  @Roles('DUENIO')
  @ApiOperation({
    summary: 'Editar un producto o reactivarlo',
    description: 'El stock actual no se edita por esta vía: se ajusta con movimientos (RN-07).',
  })
  @ApiBody({ type: ProductoPatchBodyDto })
  @ApiOkResponse({ type: ProductoDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  @ApiPaymentRequiredResponse({
    type: ApiErrorDto,
    description: 'Reactivar supera el límite del plan',
  })
  actualizar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(ProductoPatchSchema)) body: ProductoPatchBodyDto & ProductoPatch,
  ): Promise<Producto> {
    return this.products.actualizar(id, body);
  }

  @Delete(':id')
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Dar de baja (baja lógica: conserva código e historial)' })
  @ApiOkResponse({ type: ProductoDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  darDeBaja(@Param('id', new ParseUUIDPipe({ version: '4' })) id: string): Promise<Producto> {
    return this.products.darDeBaja(id);
  }
}
