import { ApiProperty } from '@nestjs/swagger';
import { MOTIVOS_RESUMEN } from '@inventariosmart/shared';

export class StockDashboardDto {
  @ApiProperty({ example: 120 }) productosActivos!: number;
  @ApiProperty({ description: 'Σ stock actual de los activos', example: 1540 }) unidades!: number;
  @ApiProperty({ description: 'Σ stock × costo vigente, neto', example: '2450000.00' })
  valorizacion!: string;
  @ApiProperty({ example: 4 }) sinStock!: number;
  @ApiProperty({ example: 9 }) stockBajo!: number;
}

export class VentasDashboardDto {
  @ApiProperty({ example: 145 }) unidadesVendidas!: number;
  @ApiProperty({ example: '1230000.00' }) ventasNetas!: string;
  @ApiProperty({ example: '790000.00' }) costoVendido!: string;
  @ApiProperty({ example: '440000.00' }) margenBruto!: string;
  @ApiProperty({ nullable: true, type: String, example: '35.77' }) margenBrutoPct!: string | null;
  @ApiProperty({ example: '290000.00' }) gastos!: string;
  @ApiProperty({ nullable: true, type: String, example: '150000.00' }) margenNeto!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '12.20' }) margenNetoPct!: string | null;
  @ApiProperty({ nullable: true, enum: MOTIVOS_RESUMEN }) motivo!:
    'SIN_GASTOS' | 'SIN_VENTAS' | null;
}

export class MesAnteriorDashboardDto {
  @ApiProperty({ example: '2026-08' }) periodo!: string;
  @ApiProperty({ example: 120 }) unidadesVendidas!: number;
  @ApiProperty({ example: '980000.00' }) ventasNetas!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Variación de ventas netas contra el mes anterior',
    example: '25.51',
  })
  variacionVentasPct!: string | null;
}

export class ProductoDashboardDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ example: 'Filtro Aire FA-220' }) nombre!: string;
}

export class TopRentableDto {
  @ApiProperty({ type: ProductoDashboardDto }) producto!: ProductoDashboardDto;
  @ApiProperty({ example: 40 }) unidadesVendidas!: number;
  @ApiProperty({ example: '4000.00' }) margenBruto!: string;
  @ApiProperty({ nullable: true, type: String, example: '40.00' }) margenBrutoPct!: string | null;
  @ApiProperty({ description: 'Margen bruto generado en el mes', example: '160000.00' })
  margenBrutoMes!: string;
}

export class AlertaStockDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'BI-09' }) codigo!: string;
  @ApiProperty({ example: 'Bujía BI-09' }) nombre!: string;
  @ApiProperty({ example: 0 }) stockActual!: number;
  @ApiProperty({ example: 5 }) stockSeguridad!: number;
}

export class GrupoAlertasDto {
  @ApiProperty({ example: 4 }) total!: number;
  @ApiProperty({ type: AlertaStockDto, isArray: true, description: 'Hasta 5, por nombre' })
  items!: AlertaStockDto[];
}

export class AlertasDashboardDto {
  @ApiProperty({ type: GrupoAlertasDto }) sinStock!: GrupoAlertasDto;
  @ApiProperty({ type: GrupoAlertasDto }) stockBajo!: GrupoAlertasDto;
  @ApiProperty({ description: 'El margen neto no se puede calcular por falta de gastos del mes' })
  faltanGastos!: boolean;
}

export class DashboardDto {
  @ApiProperty({ example: '2026-09' }) periodo!: string;
  @ApiProperty({ type: StockDashboardDto }) stock!: StockDashboardDto;
  @ApiProperty({ type: VentasDashboardDto }) ventas!: VentasDashboardDto;
  @ApiProperty({ type: MesAnteriorDashboardDto }) mesAnterior!: MesAnteriorDashboardDto;
  @ApiProperty({ type: TopRentableDto, isArray: true }) topRentables!: TopRentableDto[];
  @ApiProperty({ type: AlertasDashboardDto }) alertas!: AlertasDashboardDto;
}
