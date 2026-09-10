import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ESTADOS_STOCK } from '@inventariosmart/shared';

export class ProductoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'FA-220' })
  codigo!: string;

  @ApiProperty({ example: 'Filtro Aire FA-220' })
  nombre!: string;

  @ApiProperty({ nullable: true, type: String, example: 'Repuestos' })
  categoria!: string | null;

  @ApiProperty({
    description: 'Precio de venta con IVA incluido, decimal como string',
    example: '3900.00',
  })
  precioVenta!: string;

  @ApiProperty({ description: 'Alícuota de IVA (%)', example: '21' })
  alicuotaIva!: string;

  @ApiPropertyOptional({
    description: 'Costo de reposición sin IVA. Omitido para el rol EMPLEADO.',
    example: '2340.00',
  })
  costoReposicion?: string;

  @ApiProperty({ example: 47 })
  stockActual!: number;

  @ApiProperty({ example: 10 })
  stockSeguridad!: number;

  @ApiProperty({ enum: ESTADOS_STOCK })
  estadoStock!: 'SIN_STOCK' | 'BAJO' | 'OK';

  @ApiProperty()
  activo!: boolean;

  @ApiProperty({ format: 'date-time' })
  creadoEn!: string;

  @ApiProperty({ format: 'date-time' })
  actualizadoEn!: string;
}

export class ListaProductosDto {
  @ApiProperty({ type: ProductoDto, isArray: true })
  items!: ProductoDto[];

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Cursor de la página siguiente o null',
  })
  siguienteCursor!: string | null;
}

export class ProductoCreateBodyDto {
  @ApiProperty({ maxLength: 64, example: 'FA-220' })
  codigo!: string;

  @ApiProperty({ minLength: 2, maxLength: 120, example: 'Filtro Aire FA-220' })
  nombre!: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 60 })
  categoria?: string | null;

  @ApiProperty({ description: 'Con IVA incluido; número o string decimal', example: '3900.00' })
  precioVenta!: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, description: 'Default: IVA del comercio' })
  alicuotaIva?: number;

  @ApiProperty({ description: 'Sin IVA; número o string decimal', example: '2340.00' })
  costoReposicion!: string;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  stockInicial?: number;

  @ApiPropertyOptional({ minimum: 0, default: 0 })
  stockSeguridad?: number;
}

export class ProductoPatchBodyDto {
  @ApiPropertyOptional({ maxLength: 64 })
  codigo?: string;

  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  nombre?: string;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 60 })
  categoria?: string | null;

  @ApiPropertyOptional({ example: '3990.00' })
  precioVenta?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  alicuotaIva?: number;

  @ApiPropertyOptional({ example: '2400.00' })
  costoReposicion?: string;

  @ApiPropertyOptional({ minimum: 0 })
  stockSeguridad?: number;

  @ApiPropertyOptional({ description: 'true reactiva un producto dado de baja' })
  activo?: boolean;
}
