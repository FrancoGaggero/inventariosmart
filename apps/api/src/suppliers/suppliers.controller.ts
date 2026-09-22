import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type ImportacionConfirm,
  ImportacionConfirmSchema,
  LIMITE_BYTES_IMPORTACION,
  type ListaPrecios,
  type ListaProveedores,
  type PreciosCreate,
  PreciosCreateSchema,
  type Proveedor,
  type ProveedorCreate,
  ProveedorCreateSchema,
  type ProveedorPatch,
  ProveedorPatchSchema,
  type ProveedoresQuery,
  ProveedoresQuerySchema,
  type ResultadoImportacion,
  type VistaPrevia,
} from '@inventariosmart/shared';
import { memoryStorage } from 'multer';
import { z } from 'zod';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { validacion } from '../common/errors';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { PriceListService } from './price-list.service';
import { PricesService, type ResultadoRegistroPrecios } from './prices.service';
import {
  ArchivoListaDto,
  ImportacionConfirmBodyDto,
  ListaPreciosDto,
  ListaProveedoresDto,
  PreciosCreadosDto,
  PreciosCreateBodyDto,
  ProveedorCreateBodyDto,
  ProveedorDto,
  ProveedorPatchBodyDto,
  ResultadoImportacionDto,
  VistaPreviaDto,
} from './suppliers.dto';
import { SuppliersService } from './suppliers.service';

const PaginacionSchema = z.object({
  cursor: z.string().max(400).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
type Paginacion = z.infer<typeof PaginacionSchema>;

const UUID_V4 = new ParseUUIDPipe({ version: '4' });

@ApiTags('proveedores')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Sólo el DUENIO ve proveedores y costos' })
@Roles('DUENIO')
@Controller('suppliers')
export class SuppliersController {
  constructor(
    private readonly suppliers: SuppliersService,
    private readonly prices: PricesService,
    private readonly priceList: PriceListService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar proveedores del comercio' })
  @ApiQuery({ name: 'q', required: false, description: 'Texto a buscar en el nombre' })
  @ApiQuery({
    name: 'activo',
    required: false,
    enum: ['true', 'false'],
    description: 'Default true',
  })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  @ApiOkResponse({ type: ListaProveedoresDto })
  listar(
    @Query(new ZodValidationPipe(ProveedoresQuerySchema)) query: ProveedoresQuery,
  ): Promise<ListaProveedores> {
    return this.suppliers.listar(query);
  }

  @Post()
  @ApiOperation({ summary: 'Crear un proveedor' })
  @ApiBody({ type: ProveedorCreateBodyDto })
  @ApiCreatedResponse({ type: ProveedorDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'VALIDACION con details por campo' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Nombre repetido en el comercio' })
  crear(
    @Body(new ZodValidationPipe(ProveedorCreateSchema))
    body: ProveedorCreateBodyDto & ProveedorCreate,
  ): Promise<Proveedor> {
    return this.suppliers.crear(body);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un proveedor' })
  @ApiOkResponse({ type: ProveedorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  obtener(@Param('id', UUID_V4) id: string): Promise<Proveedor> {
    return this.suppliers.obtener(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Editar un proveedor (datos, lead time, confiabilidad) o reactivarlo' })
  @ApiBody({ type: ProveedorPatchBodyDto })
  @ApiOkResponse({ type: ProveedorDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  actualizar(
    @Param('id', UUID_V4) id: string,
    @Body(new ZodValidationPipe(ProveedorPatchSchema)) body: ProveedorPatchBodyDto & ProveedorPatch,
  ): Promise<Proveedor> {
    return this.suppliers.actualizar(id, body);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Dar de baja (baja lógica: conserva el historial de precios)' })
  @ApiOkResponse({ type: ProveedorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  darDeBaja(@Param('id', UUID_V4) id: string): Promise<Proveedor> {
    return this.suppliers.darDeBaja(id);
  }

  @Get(':id/prices')
  @ApiOperation({
    summary: 'Lista de precios vigente del proveedor',
    description: 'Último costo informado por producto, en orden alfabético, con cursor.',
  })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 100, default: 25 },
  })
  @ApiOkResponse({ type: ListaPreciosDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  listaVigente(
    @Param('id', UUID_V4) id: string,
    @Query(new ZodValidationPipe(PaginacionSchema)) pag: Paginacion,
  ): Promise<ListaPrecios> {
    return this.prices.listaVigente(id, pag);
  }

  @Post(':id/prices')
  @ApiOperation({
    summary: 'Cargar costos a mano',
    description:
      'Inserta filas de historial (origen MANUAL). Si el proveedor es el principal del producto, o el producto no tenía proveedor, actualiza su costo vigente (RN-08).',
  })
  @ApiBody({ type: PreciosCreateBodyDto })
  @ApiCreatedResponse({ type: PreciosCreadosDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'Proveedor o producto inexistente' })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Proveedor dado de baja' })
  cargarPrecios(
    @Param('id', UUID_V4) id: string,
    @Body(new ZodValidationPipe(PreciosCreateSchema)) body: PreciosCreateBodyDto & PreciosCreate,
  ): Promise<ResultadoRegistroPrecios> {
    return this.prices.registrar({
      proveedorId: id,
      items: body.items,
      origen: 'MANUAL',
      vigenteDesde: body.vigenteDesde ?? null,
    });
  }

  @Post(':id/price-list/preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      // Tope duro (413) un poco por encima del límite funcional, que se informa como 400.
      limits: { fileSize: LIMITE_BYTES_IMPORTACION * 2, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Vista previa de una lista de precios (.xlsx o .csv)',
    description:
      'Clasifica cada fila: NUEVO, CAMBIA (con costo anterior), IGUAL, SIN_PRODUCTO o INVALIDA. No registra nada; el archivo no se conserva.',
  })
  @ApiBody({ type: ArchivoListaDto })
  @ApiOkResponse({ type: VistaPreviaDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Archivo inválido, vacío o demasiado grande',
  })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  vistaPrevia(
    @Param('id', UUID_V4) id: string,
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ): Promise<VistaPrevia> {
    if (!archivo) {
      throw validacion('Adjuntá la planilla en el campo "archivo".', {
        archivo: 'Falta el archivo.',
      });
    }
    if (archivo.size > LIMITE_BYTES_IMPORTACION) {
      throw validacion('El archivo supera los 2 MB.', { archivo: 'Máximo 2 MB.' });
    }
    return this.priceList.vistaPrevia(id, archivo.buffer, archivo.originalname);
  }

  @Post(':id/price-list')
  @ApiOperation({
    summary: 'Confirmar la importación de una lista de precios',
    description:
      'Registra las filas como un lote IMPORT y aplica RN-08. Las que ya son el costo vigente del proveedor se omiten, así reenviar la misma vista previa no duplica nada.',
  })
  @ApiBody({ type: ImportacionConfirmBodyDto })
  @ApiCreatedResponse({ type: ResultadoImportacionDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto })
  confirmar(
    @Param('id', UUID_V4) id: string,
    @Body(new ZodValidationPipe(ImportacionConfirmSchema))
    body: ImportacionConfirmBodyDto & ImportacionConfirm,
  ): Promise<ResultadoImportacion> {
    return this.priceList.confirmar(id, body);
  }
}
