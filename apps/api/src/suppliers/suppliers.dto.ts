import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ESTADOS_FILA_IMPORTACION, ORIGENES_PRECIO } from '@inventariosmart/shared';

export class ProveedorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Distribuidora Norte' })
  nombre!: string;

  @ApiProperty({ nullable: true, type: String })
  contacto!: string | null;

  @ApiProperty({ nullable: true, type: String })
  email!: string | null;

  @ApiProperty({ nullable: true, type: String })
  telefono!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '30712345678' })
  cuit!: string | null;

  @ApiProperty({ description: 'Plazo de entrega en días (alimenta RN-04)', example: 7 })
  leadTimeDias!: number;

  @ApiProperty({ description: 'Índice de confiabilidad de 1 a 5', example: 3 })
  confiabilidad!: number;

  @ApiProperty({ nullable: true, type: String })
  notas!: string | null;

  @ApiProperty()
  activo!: boolean;

  @ApiProperty({ format: 'date-time' })
  creadoEn!: string;

  @ApiProperty({ format: 'date-time' })
  actualizadoEn!: string;
}

export class ListaProveedoresDto {
  @ApiProperty({ type: ProveedorDto, isArray: true })
  items!: ProveedorDto[];

  @ApiProperty({ nullable: true, type: String })
  siguienteCursor!: string | null;
}

export class ProveedorCreateBodyDto {
  @ApiProperty({ minLength: 2, maxLength: 120, example: 'Distribuidora Norte' })
  nombre!: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 120 })
  contacto?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: 'email' })
  email?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 40 })
  telefono?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, description: '11 dígitos sin guiones' })
  cuit?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 365, description: 'Por defecto, 7 días' })
  leadTimeDias?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 5, description: 'De 1 a 5; por defecto, 3' })
  confiabilidad?: number;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 500 })
  notas?: string | null;
}

export class ProveedorPatchBodyDto extends ProveedorCreateBodyDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  declare nombre: string;

  @ApiPropertyOptional({ description: 'true reactiva un proveedor dado de baja' })
  activo?: boolean;
}

export class ProductoResumenPrecioDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'FA-220' })
  codigo!: string;

  @ApiProperty({ example: 'Filtro Aire FA-220' })
  nombre!: string;
}

export class ProveedorResumenDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Distribuidora Norte' })
  nombre!: string;
}

export class UsuarioResumenPrecioDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  nombre!: string | null;
}

export class PrecioProveedorDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: ProductoResumenPrecioDto })
  producto!: ProductoResumenPrecioDto;

  @ApiProperty({ type: ProveedorResumenDto })
  proveedor!: ProveedorResumenDto;

  @ApiProperty({ description: 'Costo neto sin IVA, decimal como string', example: '2340.00' })
  costoNeto!: string;

  @ApiProperty({ format: 'date-time' })
  vigenteDesde!: string;

  @ApiProperty({ enum: ORIGENES_PRECIO })
  origen!: 'MANUAL' | 'IMPORT';

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  loteId!: string | null;

  @ApiProperty({ type: UsuarioResumenPrecioDto })
  usuario!: UsuarioResumenPrecioDto;

  @ApiProperty({ format: 'date-time' })
  creadoEn!: string;
}

export class ListaPreciosDto {
  @ApiProperty({ type: PrecioProveedorDto, isArray: true })
  items!: PrecioProveedorDto[];

  @ApiProperty({ nullable: true, type: String })
  siguienteCursor!: string | null;
}

export class ItemPrecioBodyDto {
  @ApiProperty({ format: 'uuid' })
  productoId!: string;

  @ApiProperty({ description: 'Costo neto sin IVA; número o string decimal', example: '2340.00' })
  costoNeto!: string;
}

export class PreciosCreateBodyDto {
  @ApiProperty({ type: ItemPrecioBodyDto, isArray: true, minItems: 1, maxItems: 500 })
  items!: ItemPrecioBodyDto[];

  @ApiPropertyOptional({ format: 'date-time', description: 'Por defecto, ahora. No futura.' })
  vigenteDesde?: string;
}

export class PreciosCreadosDto {
  @ApiProperty({ type: PrecioProveedorDto, isArray: true })
  filas!: PrecioProveedorDto[];

  @ApiProperty({ description: 'Productos cuyo costo vigente cambió (RN-08)' })
  productosActualizados!: number;
}

export class ArchivoListaDto {
  @ApiProperty({ type: 'string', format: 'binary', description: '.xlsx o .csv, hasta 2 MB' })
  archivo!: unknown;
}

export class FilaVistaPreviaDto {
  @ApiProperty({ description: 'Número de fila de datos en la planilla (1 = primera)' })
  fila!: number;

  @ApiProperty({ example: 'FA-220' })
  codigo!: string;

  @ApiProperty({ nullable: true, type: String, example: '2340.00' })
  costoNeto!: string | null;

  @ApiProperty({ enum: ESTADOS_FILA_IMPORTACION })
  estado!: (typeof ESTADOS_FILA_IMPORTACION)[number];

  @ApiProperty({ nullable: true, type: String, format: 'uuid' })
  productoId!: string | null;

  @ApiProperty({ nullable: true, type: String })
  nombre!: string | null;

  @ApiProperty({ nullable: true, type: String, description: 'Último costo de este proveedor' })
  costoAnterior!: string | null;

  @ApiProperty({ nullable: true, type: String })
  error!: string | null;
}

export class ResumenVistaPreviaDto {
  @ApiProperty() total!: number;
  @ApiProperty() nuevos!: number;
  @ApiProperty() cambios!: number;
  @ApiProperty() iguales!: number;
  @ApiProperty() sinProducto!: number;
  @ApiProperty() invalidas!: number;
}

export class VistaPreviaDto {
  @ApiProperty({ type: FilaVistaPreviaDto, isArray: true })
  filas!: FilaVistaPreviaDto[];

  @ApiProperty({ type: ResumenVistaPreviaDto })
  resumen!: ResumenVistaPreviaDto;
}

export class ImportacionConfirmBodyDto {
  @ApiProperty({
    type: ItemPrecioBodyDto,
    isArray: true,
    minItems: 1,
    maxItems: 5000,
    description: 'Las filas NUEVO y CAMBIA de la vista previa',
  })
  items!: ItemPrecioBodyDto[];
}

export class ResultadoImportacionDto {
  @ApiProperty({ format: 'uuid' })
  loteId!: string;

  @ApiProperty({ description: 'Filas de costo registradas (las iguales al vigente se omiten)' })
  insertados!: number;

  @ApiProperty({ description: 'Productos cuyo costo vigente cambió (RN-08)' })
  productosActualizados!: number;
}
