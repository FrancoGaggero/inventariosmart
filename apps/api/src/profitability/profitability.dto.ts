import { ApiProperty } from '@nestjs/swagger';
import { MOTIVOS_RESUMEN } from '@inventariosmart/shared';

export class ProductoRentabilidadDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ example: 'Filtro Aire FA-220' }) nombre!: string;
}

export class RentabilidadProductoDto {
  @ApiProperty({ type: ProductoRentabilidadDto })
  producto!: ProductoRentabilidadDto;

  @ApiProperty({ description: 'Precio de venta con IVA', example: '12100.00' })
  precioVenta!: string;

  @ApiProperty({ example: '21' })
  alicuotaIva!: string;

  @ApiProperty({ description: 'Precio ÷ (1 + alícuota) (RN-03)', example: '10000.00' })
  precioNeto!: string;

  @ApiProperty({ description: 'Costo de reposición vigente, neto', example: '6000.00' })
  costoReposicion!: string;

  @ApiProperty({ description: 'Precio neto − costo (RN-01)', example: '4000.00' })
  margenBruto!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Sobre el precio neto',
    example: '40.00',
  })
  margenBrutoPct!: string | null;

  @ApiProperty({ description: 'Ventas no anuladas del mes', example: 10 })
  unidadesVendidas!: number;

  @ApiProperty({ description: 'margenBruto × unidadesVendidas', example: '40000.00' })
  margenBrutoMes!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Bruto − gasto por unidad (RN-02)',
    example: '2000.00',
  })
  margenNeto!: string | null;

  @ApiProperty({ nullable: true, type: String, example: '20.00' })
  margenNetoPct!: string | null;
}

export class ListaRentabilidadDto {
  @ApiProperty({ example: '2026-09' })
  periodo!: string;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Gasto operativo por unidad vendida del mes',
  })
  gastoPorUnidad!: string | null;

  @ApiProperty({
    nullable: true,
    enum: MOTIVOS_RESUMEN,
    description: 'Por qué el neto no es calculable',
  })
  motivoNeto!: 'SIN_GASTOS' | 'SIN_VENTAS' | null;

  @ApiProperty({ type: RentabilidadProductoDto, isArray: true })
  items!: RentabilidadProductoDto[];

  @ApiProperty({ nullable: true, type: String })
  siguienteCursor!: string | null;
}

export class ResumenRentabilidadDto {
  @ApiProperty({ example: '2026-09' }) periodo!: string;
  @ApiProperty({ example: 15 }) unidadesVendidas!: number;
  @ApiProperty({ description: 'Σ cantidad × precio unitario neto', example: '105000.00' })
  ventasNetas!: string;
  @ApiProperty({ description: 'Σ cantidad × costo vigente (RN-08)', example: '64000.00' })
  costoVendido!: string;
  @ApiProperty({ example: '41000.00' }) margenBruto!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Sobre ventas netas',
    example: '39.05',
  })
  margenBrutoPct!: string | null;
  @ApiProperty({ description: 'Gastos aplicables al mes', example: '30000.00' }) gastos!: string;
  @ApiProperty({ nullable: true, type: String, example: '11000.00' }) margenNeto!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '10.48' }) margenNetoPct!: string | null;
  @ApiProperty({ nullable: true, enum: MOTIVOS_RESUMEN }) motivo!:
    'SIN_GASTOS' | 'SIN_VENTAS' | null;
}
