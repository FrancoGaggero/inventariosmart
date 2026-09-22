import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ESTADOS_STOCK,
  MOTIVOS_AJUSTE,
  MOTIVOS_INGRESO,
  MOTIVOS_MOVIMIENTO,
  TIPOS_MOVIMIENTO,
} from '@inventariosmart/shared';

export class ProductoResumenDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'FA-220' })
  codigo!: string;

  @ApiProperty({ example: 'Filtro Aire FA-220' })
  nombre!: string;
}

export class UsuarioResumenDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String, example: 'Ana Pérez' })
  nombre!: string | null;
}

export class MovimientoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: TIPOS_MOVIMIENTO })
  tipo!: 'VENTA' | 'INGRESO' | 'AJUSTE';

  @ApiProperty({ type: ProductoResumenDto })
  producto!: ProductoResumenDto;

  @ApiProperty({ type: UsuarioResumenDto, description: 'Quién registró el movimiento' })
  usuario!: UsuarioResumenDto;

  @ApiProperty({
    description: 'Como se registró: positiva en VENTA e INGRESO; con signo en AJUSTE',
    example: 2,
  })
  cantidad!: number;

  @ApiProperty({ description: 'Delta aplicado al stock del producto', example: -2 })
  efectoStock!: number;

  @ApiProperty({ description: 'Stock del producto después del movimiento', example: 45 })
  stockResultante!: number;

  @ApiProperty({
    enum: ESTADOS_STOCK,
    description: 'Estado del producto con el stock resultante y su stock de seguridad',
  })
  estadoStock!: 'SIN_STOCK' | 'BAJO' | 'OK';

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Sólo VENTA: precio de venta vigente (con IVA) al momento de vender',
    example: '3900.00',
  })
  precioUnitario!: string | null;

  @ApiProperty({ nullable: true, enum: MOTIVOS_MOVIMIENTO })
  motivo!: (typeof MOTIVOS_MOVIMIENTO)[number] | null;

  @ApiProperty({ nullable: true, type: String, maxLength: 200 })
  observacion!: string | null;

  @ApiProperty({ format: 'date-time', description: 'Fecha del hecho (puede ser retroactiva)' })
  fecha!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'AJUSTE de anulación: id del movimiento que corrige',
  })
  corrigeAId!: string | null;

  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: 'Id del AJUSTE que anuló este movimiento',
  })
  anuladoPorId!: string | null;

  @ApiProperty({ format: 'date-time' })
  creadoEn!: string;
}

export class ListaMovimientosDto {
  @ApiProperty({ type: MovimientoDto, isArray: true })
  items!: MovimientoDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Cursor de la página siguiente o null',
  })
  siguienteCursor!: string | null;
}

export class MovimientoCreateBodyDto {
  @ApiProperty({ enum: TIPOS_MOVIMIENTO })
  tipo!: 'VENTA' | 'INGRESO' | 'AJUSTE';

  @ApiProperty({ format: 'uuid' })
  productoId!: string;

  @ApiProperty({
    description: 'Entero > 0 en VENTA e INGRESO; entero distinto de 0 (con signo) en AJUSTE',
    example: 2,
  })
  cantidad!: number;

  @ApiPropertyOptional({
    enum: [...MOTIVOS_INGRESO, ...MOTIVOS_AJUSTE],
    description: 'Obligatorio en AJUSTE; opcional en INGRESO; no aplica a VENTA',
  })
  motivo?: string;

  @ApiPropertyOptional({ maxLength: 200, nullable: true, type: String })
  observacion?: string | null;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Fecha del hecho. Por defecto, ahora. No puede ser futura.',
  })
  fecha?: string;
}

export class AnulacionBodyDto {
  @ApiPropertyOptional({ maxLength: 200, nullable: true, type: String })
  observacion?: string | null;
}
