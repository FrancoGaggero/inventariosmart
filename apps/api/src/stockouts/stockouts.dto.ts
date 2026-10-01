import { ApiProperty } from '@nestjs/swagger';

export class ProductoQuiebreRefDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ example: 'Filtro Aire FA-220' }) nombre!: string;
}

export class ProductoConQuiebresDto {
  @ApiProperty({ type: ProductoQuiebreRefDto }) producto!: ProductoQuiebreRefDto;
  @ApiProperty({ description: 'Quiebres que tocan el período', example: 1 }) quiebres!: number;
  @ApiProperty({ description: 'Días sin stock dentro del período, con un decimal', example: 5 })
  diasSinStock!: number;
  @ApiProperty({ description: 'Sigue sin stock al momento de la consulta' }) enCurso!: boolean;
  @ApiProperty({
    format: 'date-time',
    description: 'Inicio del último quiebre; como mucho, el de la ventana de 90 días',
  })
  inicioUltimo!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Unidades por día en los días con stock de los últimos 90 (RN-14)',
    example: '2.0',
  })
  demandaDiaria!: string | null;
  @ApiProperty({ type: String, nullable: true, example: '10.0' }) unidadesPerdidas!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Unidades perdidas × precio neto de IVA vigente (RN-03)',
    example: '10000.00',
  })
  ventaPerdida!: string | null;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'Unidades perdidas × margen bruto unitario vigente (RN-01)',
    example: '4000.00',
  })
  gananciaPerdida!: string | null;
  @ApiProperty({
    enum: ['SIN_HISTORIAL'],
    nullable: true,
    description: 'Menos de 7 días con stock o ninguna venta en los últimos 90: no se estima',
  })
  motivo!: 'SIN_HISTORIAL' | null;
}

export class TotalesQuiebresDto {
  @ApiProperty({ example: '13000.00' }) gananciaPerdida!: string;
  @ApiProperty({ example: '32500.00' }) ventaPerdida!: string;
  @ApiProperty({ example: '25.0' }) unidadesPerdidas!: string;
  @ApiProperty({ example: 3 }) productosAfectados!: number;
  @ApiProperty({ description: 'Productos que siguen sin stock', example: 1 }) enCurso!: number;
}

export class ListaQuiebresDto {
  @ApiProperty({ enum: [30, 60, 90], example: 30 }) dias!: number;
  @ApiProperty({ format: 'date-time' }) desde!: string;
  @ApiProperty({ format: 'date-time' }) hasta!: string;
  @ApiProperty({ type: TotalesQuiebresDto, description: 'Sobre todos los productos, sin paginar' })
  totales!: TotalesQuiebresDto;
  @ApiProperty({ type: ProductoConQuiebresDto, isArray: true }) items!: ProductoConQuiebresDto[];
  @ApiProperty({ type: String, nullable: true }) siguienteCursor!: string | null;
}

export class QuiebresDashboardDto {
  @ApiProperty({ example: '4000.00' }) gananciaPerdida!: string;
  @ApiProperty({ example: '10000.00' }) ventaPerdida!: string;
  @ApiProperty({ example: 1 }) productosAfectados!: number;
}
