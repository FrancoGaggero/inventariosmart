import { ApiProperty } from '@nestjs/swagger';
import {
  ACCIONES_ALERTA,
  ESTADOS_ALERTA,
  ESTADOS_STOCK,
  SEVERIDADES_ALERTA,
} from '@inventariosmart/shared';

export class ProductoAlertaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ example: 'Filtro Aire FA-220' }) nombre!: string;
  @ApiProperty({ example: 18 }) stockActual!: number;
  @ApiProperty({ example: 4 }) stockSeguridad!: number;
  @ApiProperty({ enum: ESTADOS_STOCK }) estadoStock!: 'SIN_STOCK' | 'BAJO' | 'OK';
}

export class ProveedorAlertaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Distribuidora Norte' }) nombre!: string;
  @ApiProperty({ example: 5 }) leadTimeDias!: number;
}

export class AlertaDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: ProductoAlertaDto }) producto!: ProductoAlertaDto;
  @ApiProperty({ type: ProveedorAlertaDto, nullable: true }) proveedor!: ProveedorAlertaDto | null;
  @ApiProperty({ enum: ESTADOS_ALERTA }) estado!: (typeof ESTADOS_ALERTA)[number];
  @ApiProperty({ enum: SEVERIDADES_ALERTA }) severidad!: (typeof SEVERIDADES_ALERTA)[number];
  @ApiProperty({ example: 18, description: 'Stock al momento del último cálculo' }) stock!: number;
  @ApiProperty({ example: '2.000', description: 'Unidades por día (RN-04)' })
  velocidadDiaria!: string;
  @ApiProperty({ nullable: true, type: Number, example: 9 }) diasCobertura!: number | null;
  @ApiProperty({ example: 14 }) puntoReposicion!: number;
  @ApiProperty({ example: 20 }) umbral!: number;
  @ApiProperty({ example: 5 }) leadTimeDias!: number;
  @ApiProperty({ example: 3 }) diasAnticipacion!: number;
  @ApiProperty({ example: 56 }) cantidadSugerida!: number;
  @ApiProperty() generadaEn!: string;
  @ApiProperty() actualizadaEn!: string;
  @ApiProperty({ nullable: true, type: String }) pospuestaHasta!: string | null;
  @ApiProperty({ nullable: true, type: String }) atendidaEn!: string | null;
  @ApiProperty({ nullable: true, type: String }) resueltaEn!: string | null;
  @ApiProperty({ nullable: true, type: String }) notificadaEn!: string | null;
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description:
      'Orden de compra que la atendió (HU-07); null si se atendió a mano o sigue abierta',
  })
  ordenCompraId!: string | null;
}

export class ListaAlertasDto {
  @ApiProperty({ type: AlertaDto, isArray: true }) items!: AlertaDto[];
  @ApiProperty({ nullable: true, type: String }) siguienteCursor!: string | null;
}

export class ResumenAlertasDto {
  @ApiProperty({ example: 3 }) activas!: number;
  @ApiProperty({ example: 1 }) criticas!: number;
  @ApiProperty({ example: 0 }) pospuestas!: number;
  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Último recálculo; null si nunca corrió',
  })
  calculadasEn!: string | null;
}

export class ResultadoRecalculoDto {
  @ApiProperty({ example: 2 }) creadas!: number;
  @ApiProperty({ example: 5 }) actualizadas!: number;
  @ApiProperty({ example: 1 }) resueltas!: number;
  @ApiProperty() calculadasEn!: string;
}

export class AlertaAccionBodyDto {
  @ApiProperty({ enum: ACCIONES_ALERTA, description: 'ATENDER: ya se pidió; POSPONER: 7 días' })
  accion!: (typeof ACCIONES_ALERTA)[number];
}
