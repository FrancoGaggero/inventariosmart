import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ESTADOS_ORDEN,
  MOTIVOS_ELECCION,
  MOTIVOS_NO_ENVIO,
  SEVERIDADES_ALERTA,
  SEVERIDADES_SUGERENCIA,
} from '@inventariosmart/shared';

type EstadoOrden = (typeof ESTADOS_ORDEN)[number];
type MotivoNoEnvio = (typeof MOTIVOS_NO_ENVIO)[number];
type MotivoEleccion = (typeof MOTIVOS_ELECCION)[number];
type Severidad = (typeof SEVERIDADES_ALERTA)[number];

export class ProductoOrdenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ example: 'Filtro Aire FA-220' }) nombre!: string;
  @ApiProperty({ example: 10 }) stockActual!: number;
}

export class ProveedorOrdenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Sur' }) nombre!: string;
  @ApiProperty({ nullable: true, type: String }) contacto!: string | null;
  @ApiProperty({ nullable: true, type: String }) email!: string | null;
  @ApiProperty({ example: 7 }) leadTimeDias!: number;
  @ApiProperty({ example: 3 }) confiabilidad!: number;
}

export class ItemSugeridoDto {
  @ApiProperty({ type: ProductoOrdenDto }) producto!: ProductoOrdenDto;
  @ApiProperty({ format: 'uuid' }) alertaId!: string;
  @ApiProperty({ enum: SEVERIDADES_ALERTA }) severidad!: Severidad;
  @ApiProperty({ nullable: true, type: Number }) diasCobertura!: number | null;
  @ApiProperty({ example: 64, description: 'Cantidad sugerida por la alerta (mínimo 1)' })
  cantidad!: number;
  @ApiProperty({ nullable: true, type: String, example: '2000.00' })
  costoUnitarioNeto!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '128000.00' }) subtotal!: string | null;
  @ApiProperty({ enum: MOTIVOS_ELECCION }) motivoEleccion!: MotivoEleccion;
}

export class GrupoSugeridoDto {
  @ApiProperty({ type: ProveedorOrdenDto }) proveedor!: ProveedorOrdenDto;
  @ApiProperty({ type: ItemSugeridoDto, isArray: true }) items!: ItemSugeridoDto[];
  @ApiProperty({ example: '128000.00' }) totalNeto!: string;
}

export class ProductoSinProveedorDto {
  @ApiProperty({ type: ProductoOrdenDto }) producto!: ProductoOrdenDto;
  @ApiProperty({ format: 'uuid' }) alertaId!: string;
  @ApiProperty({ enum: SEVERIDADES_ALERTA }) severidad!: Severidad;
  @ApiProperty({ example: 36 }) cantidad!: number;
}

export class SugerenciaOrdenesDto {
  @ApiProperty({ enum: SEVERIDADES_SUGERENCIA }) severidad!: 'CRITICA' | 'TODAS';
  @ApiProperty({ type: GrupoSugeridoDto, isArray: true }) grupos!: GrupoSugeridoDto[];
  @ApiProperty({ type: ProductoSinProveedorDto, isArray: true })
  sinProveedor!: ProductoSinProveedorDto[];
  @ApiProperty({ nullable: true, type: String }) calculadasEn!: string | null;
}

export class ItemOrdenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ type: ProductoOrdenDto }) producto!: ProductoOrdenDto;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) alertaId!: string | null;
  @ApiProperty({ example: 64 }) cantidad!: number;
  @ApiProperty({ nullable: true, type: String, example: '2000.00' })
  costoUnitarioNeto!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '128000.00' }) subtotal!: string | null;
}

export class UsuarioOrdenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ nullable: true, type: String }) nombre!: string | null;
}

export class OrdenCompraDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'OC-0001' }) numero!: string;
  @ApiProperty({ enum: ESTADOS_ORDEN }) estado!: EstadoOrden;
  @ApiProperty({ type: ProveedorOrdenDto }) proveedor!: ProveedorOrdenDto;
  @ApiProperty({ type: ItemOrdenDto, isArray: true }) items!: ItemOrdenDto[];
  @ApiProperty({ example: '128000.00' }) totalNeto!: string;
  @ApiProperty({ example: 'Orden de compra OC-0001 · Repuestos Carlos' }) asunto!: string;
  @ApiProperty({ description: 'Texto del pedido, generado o editado por el dueño' }) texto!: string;
  @ApiProperty({ description: 'true si el dueño reemplazó el texto generado' })
  textoEditado!: boolean;
  @ApiProperty({ nullable: true, type: String }) notas!: string | null;
  @ApiProperty({ enum: MOTIVOS_NO_ENVIO, nullable: true }) motivoNoEnvio!: MotivoNoEnvio | null;
  @ApiProperty({ type: UsuarioOrdenDto }) creadaPor!: UsuarioOrdenDto;
  @ApiProperty({ type: UsuarioOrdenDto, nullable: true }) confirmadaPor!: UsuarioOrdenDto | null;
  @ApiProperty({ nullable: true, type: String }) confirmadaEn!: string | null;
  @ApiProperty({ nullable: true, type: String }) enviadaEn!: string | null;
  @ApiProperty({ nullable: true, type: String }) enviadaA!: string | null;
  @ApiProperty({ nullable: true, type: String }) canceladaEn!: string | null;
  @ApiProperty() creadoEn!: string;
  @ApiProperty() actualizadoEn!: string;
}

export class ProveedorResumenOrdenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'Sur' }) nombre!: string;
}

export class OrdenResumenDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'OC-0001' }) numero!: string;
  @ApiProperty({ enum: ESTADOS_ORDEN }) estado!: EstadoOrden;
  @ApiProperty({ type: ProveedorResumenOrdenDto }) proveedor!: ProveedorResumenOrdenDto;
  @ApiProperty({ example: 2 }) cantidadItems!: number;
  @ApiProperty({ example: '128000.00' }) totalNeto!: string;
  @ApiProperty({ enum: MOTIVOS_NO_ENVIO, nullable: true }) motivoNoEnvio!: MotivoNoEnvio | null;
  @ApiProperty({ nullable: true, type: String }) confirmadaEn!: string | null;
  @ApiProperty({ nullable: true, type: String }) enviadaEn!: string | null;
  @ApiProperty() creadoEn!: string;
}

export class ListaOrdenesDto {
  @ApiProperty({ type: OrdenResumenDto, isArray: true }) items!: OrdenResumenDto[];
  @ApiProperty({ nullable: true, type: String }) siguienteCursor!: string | null;
}

export class ItemOrdenBodyDto {
  @ApiProperty({ format: 'uuid' }) productoId!: string;
  @ApiProperty({ example: 64, minimum: 1 }) cantidad!: number;
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Alerta de origen',
  })
  alertaId?: string | null;
}

export class OrdenCreateBodyDto {
  @ApiProperty({ format: 'uuid' }) proveedorId!: string;
  @ApiProperty({ type: ItemOrdenBodyDto, isArray: true, minItems: 1 }) items!: ItemOrdenBodyDto[];
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 }) notas?: string | null;
}

export class OrdenPatchBodyDto {
  @ApiPropertyOptional({ format: 'uuid' }) proveedorId?: string;
  @ApiPropertyOptional({ type: ItemOrdenBodyDto, isArray: true, description: 'Reemplaza la lista' })
  items?: ItemOrdenBodyDto[];
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 500 }) notas?: string | null;
  @ApiPropertyOptional({ maxLength: 200 }) asunto?: string;
  @ApiPropertyOptional({ maxLength: 10_000, description: 'Marca el texto como editado a mano' })
  texto?: string;
  @ApiPropertyOptional({ description: 'Descarta el texto editado y vuelve al generado' })
  regenerarTexto?: boolean;
}
