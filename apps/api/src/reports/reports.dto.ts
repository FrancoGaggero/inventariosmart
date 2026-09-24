import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MOTIVOS_NO_ENVIO_REPORTE, MOTIVOS_RESUMEN } from '@inventariosmart/shared';

type MotivoNoEnvio = (typeof MOTIVOS_NO_ENVIO_REPORTE)[number];
type MotivoResumen = (typeof MOTIVOS_RESUMEN)[number];

export class ProductoReporteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ example: 'Filtro Aire FA-220' }) nombre!: string;
}

export class ResumenSemanaDto {
  @ApiProperty({ example: 40 }) unidadesVendidas!: number;
  @ApiProperty({ example: '113223.10' }) ventasNetas!: string;
  @ApiProperty({ example: '72000.00' }) costoVendido!: string;
  @ApiProperty({ example: '41223.10' }) margenBruto!: string;
  @ApiProperty({ nullable: true, type: String, example: '36.41' }) margenBrutoPct!: string | null;
  @ApiProperty({ nullable: true, type: String, description: 'Gasto por unidad del mes (RN-02)' })
  gastoPorUnidad!: string | null;
  @ApiProperty({ example: '100000.00', description: 'Gasto por unidad × unidades de la semana' })
  gastos!: string;
  @ApiProperty({ nullable: true, type: String }) margenNeto!: string | null;
  @ApiProperty({ nullable: true, type: String }) margenNetoPct!: string | null;
  @ApiProperty({ enum: MOTIVOS_RESUMEN, nullable: true }) motivo!: MotivoResumen | null;
}

export class SemanaAnteriorDto {
  @ApiProperty({ example: '2026-W37' }) semana!: string;
  @ApiProperty({ example: '100000.00' }) ventasNetas!: string;
  @ApiProperty({ example: 35 }) unidadesVendidas!: number;
  @ApiProperty({ nullable: true, type: String, example: '13.22' })
  variacionVentasPct!: string | null;
}

export class EstrellaDto {
  @ApiProperty({ type: ProductoReporteDto }) producto!: ProductoReporteDto;
  @ApiProperty({ example: 30 }) unidadesVendidas!: number;
  @ApiProperty({ example: '1123.14' }) margenBruto!: string;
  @ApiProperty({ nullable: true, type: String }) margenBrutoPct!: string | null;
  @ApiProperty({ example: '33694.20' }) margenBrutoSemana!: string;
}

export class OportunidadCompraDto {
  @ApiProperty({ type: ProductoReporteDto }) producto!: ProductoReporteDto;
  @ApiProperty({ nullable: true, type: String }) proveedorActual!: string | null;
  @ApiProperty({ example: 'Sur' }) proveedorSugerido!: string;
  @ApiProperty({ format: 'uuid' }) proveedorSugeridoId!: string;
  @ApiProperty({ example: '2340.00' }) costoActual!: string;
  @ApiProperty({ example: '2000.00' }) costoSugerido!: string;
  @ApiProperty({ example: 60 }) unidades30d!: number;
  @ApiProperty({ example: '20400.00' }) ahorroEstimado!: string;
}

export class CapitalInmovilizadoDto {
  @ApiProperty({ type: ProductoReporteDto }) producto!: ProductoReporteDto;
  @ApiProperty({ example: 20 }) stock!: number;
  @ApiProperty({ example: '500.00' }) costoActual!: string;
  @ApiProperty({ example: '10000.00' }) monto!: string;
}

export class MargenBajoDto {
  @ApiProperty({ type: ProductoReporteDto }) producto!: ProductoReporteDto;
  @ApiProperty({ example: '1000.00' }) precioNeto!: string;
  @ApiProperty({ example: '900.00' }) costoActual!: string;
  @ApiProperty({ example: '10.00' }) margenBrutoPct!: string;
  @ApiProperty({ example: 3 }) unidadesSemana!: number;
  @ApiProperty({ example: '3000.00' }) monto!: string;
}

export class ListaOportunidadCompraDto {
  @ApiProperty({ type: OportunidadCompraDto, isArray: true }) items!: OportunidadCompraDto[];
  @ApiProperty({ example: '20400.00' }) total!: string;
}
export class ListaCapitalInmovilizadoDto {
  @ApiProperty({ type: CapitalInmovilizadoDto, isArray: true }) items!: CapitalInmovilizadoDto[];
  @ApiProperty({ example: '10000.00' }) total!: string;
}
export class ListaMargenBajoDto {
  @ApiProperty({ type: MargenBajoDto, isArray: true }) items!: MargenBajoDto[];
  @ApiProperty({ example: '3000.00' }) total!: string;
}

export class OportunidadesDto {
  @ApiProperty({ type: ListaOportunidadCompraDto }) comprarMasBarato!: ListaOportunidadCompraDto;
  @ApiProperty({ type: ListaCapitalInmovilizadoDto })
  capitalInmovilizado!: ListaCapitalInmovilizadoDto;
  @ApiProperty({ type: ListaMargenBajoDto }) margenBajo!: ListaMargenBajoDto;
}

export class AlertaCriticaReporteDto {
  @ApiProperty({ type: ProductoReporteDto }) producto!: ProductoReporteDto;
  @ApiProperty({ example: 3 }) stock!: number;
  @ApiProperty({ nullable: true, type: Number }) diasCobertura!: number | null;
  @ApiProperty({ example: 64 }) cantidadSugerida!: number;
}

export class ContenidoReporteDto {
  @ApiProperty({ example: '2026-W38' }) semana!: string;
  @ApiProperty() desde!: string;
  @ApiProperty() hasta!: string;
  @ApiProperty({ example: '2026-09' }) mesGastos!: string;
  @ApiProperty({ type: ResumenSemanaDto }) resumen!: ResumenSemanaDto;
  @ApiProperty({ type: SemanaAnteriorDto }) semanaAnterior!: SemanaAnteriorDto;
  @ApiProperty({ type: EstrellaDto, isArray: true }) estrellas!: EstrellaDto[];
  @ApiProperty({ type: OportunidadesDto }) oportunidades!: OportunidadesDto;
  @ApiProperty({ type: AlertaCriticaReporteDto, isArray: true })
  alertasCriticas!: AlertaCriticaReporteDto[];
  @ApiProperty() generadoEn!: string;
}

export class ReporteSemanalDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: '2026-W38' }) semana!: string;
  @ApiProperty() desde!: string;
  @ApiProperty() hasta!: string;
  @ApiProperty({ type: ContenidoReporteDto }) contenido!: ContenidoReporteDto;
  @ApiProperty({ type: String, isArray: true }) destinatarios!: string[];
  @ApiProperty({ nullable: true, type: String }) enviadoEn!: string | null;
  @ApiProperty({ enum: MOTIVOS_NO_ENVIO_REPORTE, nullable: true })
  motivoNoEnvio!: MotivoNoEnvio | null;
  @ApiProperty() generadoEn!: string;
}

export class ReporteResumenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: '2026-W38' }) semana!: string;
  @ApiProperty() desde!: string;
  @ApiProperty() hasta!: string;
  @ApiProperty({ example: 40 }) unidadesVendidas!: number;
  @ApiProperty({ example: '113223.10' }) ventasNetas!: string;
  @ApiProperty({ example: '41223.10' }) margenBruto!: string;
  @ApiProperty({ nullable: true, type: String }) margenBrutoPct!: string | null;
  @ApiProperty({ nullable: true, type: String }) variacionVentasPct!: string | null;
  @ApiProperty({ example: 2, description: 'Productos con alguna oportunidad de ahorro' })
  oportunidades!: number;
  @ApiProperty({ nullable: true, type: String }) enviadoEn!: string | null;
  @ApiProperty({ enum: MOTIVOS_NO_ENVIO_REPORTE, nullable: true })
  motivoNoEnvio!: MotivoNoEnvio | null;
  @ApiProperty() generadoEn!: string;
}

export class ListaReportesDto {
  @ApiProperty({ type: ReporteResumenDto, isArray: true }) items!: ReporteResumenDto[];
  @ApiProperty({ nullable: true, type: String }) siguienteCursor!: string | null;
}

export class GenerarReporteBodyDto {
  @ApiPropertyOptional({ example: '2026-W38', description: 'Default: la semana en curso' })
  semana?: string;
  @ApiPropertyOptional({ description: 'true: envía el correo aunque ya se haya enviado' })
  enviar?: boolean;
}

export class AjustesReportesDto {
  @ApiProperty({ example: true }) activo!: boolean;
  @ApiProperty({ type: String, isArray: true, example: ['contadora@ejemplo.test'] })
  destinatariosExtra!: string[];
}

export class AjustesReportesPatchBodyDto {
  @ApiPropertyOptional() activo?: boolean;
  @ApiPropertyOptional({ type: String, isArray: true, maxItems: 5 })
  destinatariosExtra?: string[];
}
