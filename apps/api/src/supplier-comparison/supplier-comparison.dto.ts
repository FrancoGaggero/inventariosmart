import { ApiProperty } from '@nestjs/swagger';

export class ProductoComparadorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ example: 'Filtro Aire FA-220' }) nombre!: string;
}

export class ProveedorRefComparadorDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Este' }) nombre!: string;
}

export class ProveedorComparadoDto {
  @ApiProperty({ type: ProveedorRefComparadorDto }) proveedor!: ProveedorRefComparadorDto;
  @ApiProperty({ description: 'Último costo neto del proveedor', example: '2100.00' })
  costoNeto!: string;
  @ApiProperty({ format: 'date-time', description: 'Desde cuándo rige ese costo' })
  vigenteDesde!: string;
  @ApiProperty({ example: 2 }) leadTimeDias!: number;
  @ApiProperty({ example: 5, minimum: 1, maximum: 5 }) confiabilidad!: number;
  @ApiProperty({ description: 'Cuánto más caro que el más barato, en %', example: '5.00' })
  diferenciaPct!: string;
  @ApiProperty({ description: 'Es el proveedor principal del producto' }) esPrincipal!: boolean;
  @ApiProperty({ description: '100 × costo mínimo ÷ costo', example: '95.24' })
  puntajePrecio!: string;
  @ApiProperty({ description: '100 × (plazo mínimo + 1) ÷ (plazo + 1)', example: '100.00' })
  puntajePlazo!: string;
  @ApiProperty({ description: '100 × confiabilidad ÷ 5', example: '100.00' })
  puntajeConfiabilidad!: string;
  @ApiProperty({
    description: 'RN-13: 0,60 × precio + 0,25 × plazo + 0,15 × confiabilidad',
    example: '97.14',
  })
  puntaje!: string;
}

export class ProveedorResumidoDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Este' }) nombre!: string;
  @ApiProperty({ example: '2100.00' }) costoNeto!: string;
  @ApiProperty({ example: '97.14' }) puntaje!: string;
}

export class ComparacionProductoDto {
  @ApiProperty({ type: ProductoComparadorDto }) producto!: ProductoComparadorDto;
  @ApiProperty({
    type: ProveedorComparadoDto,
    isArray: true,
    description: 'Proveedores activos con costo cargado, de mayor a menor puntaje',
  })
  proveedores!: ProveedorComparadoDto[];
  @ApiProperty({ type: ProveedorResumidoDto, nullable: true, description: 'Mayor puntaje' })
  recomendado!: ProveedorResumidoDto | null;
  @ApiProperty({ type: ProveedorResumidoDto, nullable: true })
  masBarato!: ProveedorResumidoDto | null;
  @ApiProperty({
    type: ProveedorResumidoDto,
    nullable: true,
    description: 'Proveedor principal, si está activo y tiene costo cargado',
  })
  principal!: ProveedorResumidoDto | null;
  @ApiProperty({ description: 'Tiene dos o más proveedores' }) comparable!: boolean;
  @ApiProperty({ description: 'El recomendado no es el proveedor principal' })
  cambiaProveedor!: boolean;
  @ApiProperty({ example: 60, description: 'Unidades vendidas en los últimos 30 días' })
  unidades30d!: number;
  @ApiProperty({
    nullable: true,
    type: String,
    description: '(costo del principal − costo del recomendado) × unidades de 30 días',
    example: '14400.00',
  })
  ahorroEstimado!: string | null;
}

export class InsumoComparadoDto {
  @ApiProperty({ type: ProductoComparadorDto }) producto!: ProductoComparadorDto;
  @ApiProperty({ example: 3, description: 'Cantidad de proveedores comparados' })
  proveedores!: number;
  @ApiProperty({ type: ProveedorResumidoDto }) recomendado!: ProveedorResumidoDto;
  @ApiProperty({ type: ProveedorResumidoDto }) masBarato!: ProveedorResumidoDto;
  @ApiProperty({ type: ProveedorResumidoDto, nullable: true })
  principal!: ProveedorResumidoDto | null;
  @ApiProperty() cambiaProveedor!: boolean;
  @ApiProperty({ example: 60 }) unidades30d!: number;
  @ApiProperty({ nullable: true, type: String, example: '14400.00' })
  ahorroEstimado!: string | null;
}

export class TotalesComparadorDto {
  @ApiProperty({ example: 23, description: 'Insumos con dos o más proveedores' })
  comparables!: number;
  @ApiProperty({ example: 4, description: 'Insumos cuyo recomendado no es su principal' })
  conCambio!: number;
  @ApiProperty({ example: '86400.00' }) ahorroEstimado!: string;
}

export class ResumenComparadorDto {
  @ApiProperty({ type: InsumoComparadoDto, isArray: true }) items!: InsumoComparadoDto[];
  @ApiProperty({ nullable: true, type: String }) siguienteCursor!: string | null;
  @ApiProperty({
    type: TotalesComparadorDto,
    description: 'Sobre todos los insumos comparables del comercio, sin filtros',
  })
  totales!: TotalesComparadorDto;
}
