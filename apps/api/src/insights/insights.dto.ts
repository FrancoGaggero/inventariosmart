import { ApiProperty } from '@nestjs/swagger';
import { ESTADOS_PRECIO, MOTIVOS_COMPARACION } from '@inventariosmart/shared';

const SERIE = {
  type: 'array',
  items: { type: 'string', nullable: true },
  example: ['100.00', '104.20', '118.00'],
} as const;

export class SeriesInflacionDto {
  @ApiProperty({ ...SERIE, description: 'Índice de mis precios (canasta fija); vacía sin ventas' })
  misPrecios!: (string | null)[];
  @ApiProperty({ ...SERIE, description: 'Índice de mis costos (canasta fija); vacía sin ventas' })
  misCostos!: (string | null)[];
  @ApiProperty({ ...SERIE, description: 'IPC nacional, nivel general (INDEC)' })
  ipc!: (string | null)[];
  @ApiProperty({ ...SERIE, description: 'IPC nacional, bienes (INDEC)' })
  ipcBienes!: (string | null)[];
}

export class VariacionesInflacionDto {
  @ApiProperty({ nullable: true, type: String, example: '18.00' }) misPrecios!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '22.00' }) misCostos!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '20.00' }) ipc!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '19.10' }) ipcBienes!: string | null;
}

export class BrechasInflacionDto {
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Variación real de mis precios contra la inflación (RN-11)',
    example: '-1.67',
  })
  preciosVsIpc!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Variación real de mis precios contra mis costos (RN-11)',
    example: '-3.28',
  })
  preciosVsCostos!: string | null;
}

export class ProductoRefInflacionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ example: 'Filtro Aire FA-220' }) nombre!: string;
}

export class ProductoInflacionDto {
  @ApiProperty({ type: ProductoRefInflacionDto }) producto!: ProductoRefInflacionDto;
  @ApiProperty({ example: 30 }) unidadesVendidas!: number;
  @ApiProperty({ description: 'Con IVA, al cierre del primer mes', example: '1000.00' })
  precioInicial!: string;
  @ApiProperty({ description: 'Con IVA, al cierre del último mes', example: '1100.00' })
  precioFinal!: string;
  @ApiProperty({ example: '600.00' }) costoInicial!: string;
  @ApiProperty({ example: '720.00' }) costoFinal!: string;
  @ApiProperty({ nullable: true, type: String, example: '10.00' }) variacionPrecio!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '20.00' }) variacionCosto!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Variación del precio descontada la inflación (RN-11)',
    example: '-8.33',
  })
  variacionReal!: string | null;
  @ApiProperty({
    nullable: true,
    enum: ESTADOS_PRECIO,
    description: 'ATRASADO si la variación real es menor a −2 %, ADELANTADO si supera +2 %',
  })
  estado!: (typeof ESTADOS_PRECIO)[number] | null;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Precio que habría acompañado a la inflación. Informativo: no cambia el precio',
    example: '1200.00',
  })
  precioSugeridoInflacion!: string | null;
  @ApiProperty({
    description: 'Precio que sostiene el margen bruto % del inicio con el costo final',
    example: '1200.00',
  })
  precioSugeridoMargen!: string;
  @ApiProperty({ format: 'date-time', description: 'Desde cuándo se conoce el precio' })
  datosDesde!: string;
}

export class ComparacionInflacionDto {
  @ApiProperty({ example: '2026-03' }) desde!: string;
  @ApiProperty({ example: '2026-08' }) hasta!: string;
  @ApiProperty({ description: 'El período se recortó al último mes con IPC publicado' })
  recortado!: boolean;
  @ApiProperty({ type: String, isArray: true, example: ['2026-03', '2026-04'] })
  meses!: string[];
  @ApiProperty({ type: SeriesInflacionDto, description: 'Índices base 100 al primer mes' })
  series!: SeriesInflacionDto;
  @ApiProperty({ type: VariacionesInflacionDto }) variaciones!: VariacionesInflacionDto;
  @ApiProperty({ type: BrechasInflacionDto }) brechas!: BrechasInflacionDto;
  @ApiProperty({ nullable: true, enum: MOTIVOS_COMPARACION }) motivo!:
    (typeof MOTIVOS_COMPARACION)[number] | null;
  @ApiProperty({
    type: ProductoInflacionDto,
    isArray: true,
    description: 'Productos activos, del más atrasado al más adelantado',
  })
  productos!: ProductoInflacionDto[];
}
