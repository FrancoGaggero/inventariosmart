import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  CRITERIOS_REMARCACION,
  ESTADOS_PRECIO,
  REDONDEOS,
  RESULTADOS_REMARCACION,
} from '@inventariosmart/shared';

type Criterio = (typeof CRITERIOS_REMARCACION)[number];
type Redondeo = (typeof REDONDEOS)[number];
type Resultado = (typeof RESULTADOS_REMARCACION)[number];
type Estado = (typeof ESTADOS_PRECIO)[number];

export class ParametrosRemarcacionDto {
  @ApiPropertyOptional({ example: 15, description: 'Criterio PORCENTAJE' }) porcentaje?: number;
  @ApiPropertyOptional({ example: 40, description: 'Criterio MARGEN_OBJETIVO' }) margen?: number;
  @ApiPropertyOptional({ enum: REDONDEOS }) redondeo?: Redondeo;
  @ApiPropertyOptional() permitirBajas?: boolean;
  @ApiPropertyOptional({ example: '2026-03' }) desde?: string;
  @ApiPropertyOptional({ example: '2026-08' }) hasta?: string;
}

export class RemarcacionPreviewBodyDto {
  @ApiProperty({ enum: CRITERIOS_REMARCACION }) criterio!: Criterio;
  @ApiPropertyOptional({
    example: 15,
    minimum: 0,
    maximum: 500,
    description: 'Obligatorio con el criterio PORCENTAJE',
  })
  porcentaje?: number;
  @ApiPropertyOptional({
    example: 40,
    minimum: 0,
    maximum: 95,
    description: 'Margen bruto % sobre el precio neto; obligatorio con MARGEN_OBJETIVO',
  })
  margen?: number;
  @ApiPropertyOptional({
    type: String,
    isArray: true,
    format: 'uuid',
    description: 'Productos a remarcar; sin indicarlos, todos los activos',
  })
  productoIds?: string[];
  @ApiPropertyOptional({
    enum: ESTADOS_PRECIO,
    description: 'Sólo los productos con ese estado frente a la inflación del período',
  })
  estado?: Estado;
  @ApiPropertyOptional({ example: '2026-03', description: 'AAAA-MM' }) desde?: string;
  @ApiPropertyOptional({ example: '2026-08', description: 'AAAA-MM' }) hasta?: string;
  @ApiPropertyOptional({ enum: REDONDEOS, default: 'NINGUNO', description: 'Siempre hacia arriba' })
  redondeo?: Redondeo;
  @ApiPropertyOptional({
    default: false,
    description: 'Sin esto, un precio nuevo menor al actual queda SIN_CAMBIO (RN-12)',
  })
  permitirBajas?: boolean;
}

export class ProductoRemarcacionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ example: 'Filtro Aire FA-220' }) nombre!: string;
}

export class ItemRemarcacionDto {
  @ApiProperty({ type: ProductoRemarcacionDto }) producto!: ProductoRemarcacionDto;
  @ApiProperty({ description: 'Con IVA', example: '1100.00' }) precioActual!: string;
  @ApiProperty({ nullable: true, type: String, example: '1200.00' }) precioNuevo!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '9.09' }) variacion!: string | null;
  @ApiProperty({ description: 'Costo de reposición neto', example: '720.00' }) costo!: string;
  @ApiProperty({ example: '21' }) alicuotaIva!: string;
  @ApiProperty({ nullable: true, type: String, example: '20.80' })
  margenBrutoPctActual!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '27.40' })
  margenBrutoPctNuevo!: string | null;
  @ApiProperty({ enum: RESULTADOS_REMARCACION }) resultado!: Resultado;
  @ApiProperty({ nullable: true, enum: ESTADOS_PRECIO }) estado!: Estado | null;
}

export class ResumenRemarcacionDto {
  @ApiProperty({ example: 12 }) suben!: number;
  @ApiProperty({ example: 0 }) bajan!: number;
  @ApiProperty({ example: 3 }) sinCambio!: number;
  @ApiProperty({ example: 1 }) sinDatos!: number;
}

export class VistaPreviaRemarcacionDto {
  @ApiProperty({ enum: CRITERIOS_REMARCACION }) criterio!: Criterio;
  @ApiProperty({ type: ParametrosRemarcacionDto }) parametros!: ParametrosRemarcacionDto;
  @ApiProperty({ type: ItemRemarcacionDto, isArray: true }) items!: ItemRemarcacionDto[];
  @ApiProperty({ type: ResumenRemarcacionDto }) resumen!: ResumenRemarcacionDto;
  @ApiProperty({
    nullable: true,
    enum: ['SIN_IPC'],
    description: 'Todavía no está el índice del INDEC para el criterio de inflación',
  })
  motivo!: 'SIN_IPC' | null;
}

export class ItemAplicarBodyDto {
  @ApiProperty({ format: 'uuid' }) productoId!: string;
  @ApiProperty({
    example: '1100.00',
    description: 'Precio visto en la vista previa: si cambió, no se aplica nada',
  })
  precioActual!: string;
  @ApiProperty({ example: '1270.00' }) precioNuevo!: string;
}

export class RemarcacionApplyBodyDto {
  @ApiProperty({ enum: CRITERIOS_REMARCACION }) criterio!: Criterio;
  @ApiPropertyOptional({ type: ParametrosRemarcacionDto }) parametros?: ParametrosRemarcacionDto;
  @ApiProperty({ type: ItemAplicarBodyDto, isArray: true, minItems: 1, maxItems: 5000 })
  items!: ItemAplicarBodyDto[];
}

export class UsuarioLoteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ nullable: true, type: String }) nombre!: string | null;
}

export class LoteRemarcacionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: CRITERIOS_REMARCACION }) criterio!: Criterio;
  @ApiProperty({ type: ParametrosRemarcacionDto }) parametros!: ParametrosRemarcacionDto;
  @ApiProperty({ example: 12 }) cantidad!: number;
  @ApiProperty({ type: UsuarioLoteDto }) usuario!: UsuarioLoteDto;
  @ApiProperty({ format: 'date-time' }) creadoEn!: string;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' }) revertidoEn!: string | null;
  @ApiProperty({ nullable: true, type: UsuarioLoteDto }) revertidoPor!: UsuarioLoteDto | null;
  @ApiProperty({ nullable: true, type: Number, description: 'Volvieron al precio anterior' })
  revertidos!: number | null;
  @ApiProperty({ nullable: true, type: Number, description: 'No se tocaron al deshacer' })
  omitidos!: number | null;
}

export class ItemLoteDto {
  @ApiProperty({ type: ProductoRemarcacionDto }) producto!: ProductoRemarcacionDto;
  @ApiProperty({ example: '1100.00' }) precioAnterior!: string;
  @ApiProperty({ example: '1270.00' }) precioNuevo!: string;
  @ApiProperty() revertido!: boolean;
}

export class LoteRemarcacionDetalleDto extends LoteRemarcacionDto {
  @ApiProperty({ type: ItemLoteDto, isArray: true }) items!: ItemLoteDto[];
}

export class ListaLotesDto {
  @ApiProperty({ type: LoteRemarcacionDto, isArray: true }) items!: LoteRemarcacionDto[];
  @ApiProperty({ nullable: true, type: String }) siguienteCursor!: string | null;
}

export class ProductoOmitidoDto {
  @ApiProperty({ type: ProductoRemarcacionDto }) producto!: ProductoRemarcacionDto;
  @ApiProperty({ example: '1450.00' }) precioActual!: string;
  @ApiProperty({ example: 'El precio cambió después de la remarcación.' }) motivo!: string;
}

export class ResultadoReversionDto extends LoteRemarcacionDetalleDto {
  @ApiProperty({ type: ProductoOmitidoDto, isArray: true })
  productosOmitidos!: ProductoOmitidoDto[];
}
