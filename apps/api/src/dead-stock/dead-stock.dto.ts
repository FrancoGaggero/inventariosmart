import { ApiProperty } from '@nestjs/swagger';

export class ProductoParadoRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'AC-5L' }) codigo!: string;
  @ApiProperty({ example: 'Aceite 5W-30 5L' }) nombre!: string;
}

export class ProductoParadoDto {
  @ApiProperty({ type: ProductoParadoRefDto }) producto!: ProductoParadoRefDto;
  @ApiProperty({ example: 10 }) stock!: number;
  @ApiProperty({ description: 'Costo de reposición vigente, neto (RN-08)', example: '2100.00' })
  costoReposicion!: string;
  @ApiProperty({ description: 'Stock × costo vigente (RN-15)', example: '21000.00' })
  capitalParado!: string;
  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Última venta no anulada; null si nunca se vendió',
  })
  ultimaVenta!: string | null;
  @ApiProperty({ description: 'Desde la última venta o, si no hay, desde el alta', example: 120 })
  diasSinVender!: number;
}

export class TotalesStockParadoDto {
  @ApiProperty({ example: '34000.00' }) capitalParado!: string;
  @ApiProperty({ example: 3 }) productos!: number;
  @ApiProperty({ example: 15 }) unidades!: number;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Capital parado sobre el stock valorizado de los activos, en %',
    example: '34.00',
  })
  porcentajeDelStock!: string | null;
}

export class ListaStockParadoDto {
  @ApiProperty({ enum: [30, 60, 90, 180], example: 90 }) dias!: number;
  @ApiProperty({ format: 'date-time' }) desde!: string;
  @ApiProperty({ format: 'date-time' }) hasta!: string;
  @ApiProperty({
    type: TotalesStockParadoDto,
    description: 'Sobre todos los productos, sin paginar',
  })
  totales!: TotalesStockParadoDto;
  @ApiProperty({ type: ProductoParadoDto, isArray: true }) items!: ProductoParadoDto[];
  @ApiProperty({ type: String, nullable: true }) siguienteCursor!: string | null;
}

export class StockParadoDashboardDto {
  @ApiProperty({ example: '21000.00' }) capitalParado!: string;
  @ApiProperty({ example: 1 }) productos!: number;
}
