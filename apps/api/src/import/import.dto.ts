import { ApiProperty } from '@nestjs/swagger';
import { ESTADOS_FILA_PRODUCTO } from '@inventariosmart/shared';
import { ProductoCreateBodyDto } from '../products/products.dto';

export class ArchivoProductosDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: '.xlsx o .csv, hasta 2 MB y 5.000 filas',
  })
  archivo!: unknown;
}

export class FilaImportacionDto {
  @ApiProperty({ description: 'Número de fila de datos (1 = primera)' }) fila!: number;
  @ApiProperty({ example: 'FA-220' }) codigo!: string;
  @ApiProperty({ enum: ESTADOS_FILA_PRODUCTO }) estado!: (typeof ESTADOS_FILA_PRODUCTO)[number];
  @ApiProperty({
    nullable: true,
    type: ProductoCreateBodyDto,
    description: 'Datos validados; null si es inválida',
  })
  datos!: ProductoCreateBodyDto | null;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) productoId!: string | null;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'Stock actual del existente; no cambia',
  })
  stockActual!: number | null;
  @ApiProperty({ nullable: true, type: String }) error!: string | null;
}

export class ResumenImportacionDto {
  @ApiProperty() total!: number;
  @ApiProperty() nuevos!: number;
  @ApiProperty() actualizan!: number;
  @ApiProperty() invalidas!: number;
  @ApiProperty() productosActualesActivos!: number;
  @ApiProperty() productosResultantes!: number;
  @ApiProperty({ nullable: true, type: Number }) limitePlan!: number | null;
  @ApiProperty() superaLimite!: boolean;
}

export class VistaPreviaImportacionDto {
  @ApiProperty({ type: FilaImportacionDto, isArray: true }) filas!: FilaImportacionDto[];
  @ApiProperty({ type: ResumenImportacionDto }) resumen!: ResumenImportacionDto;
}

export class FilaConfirmDto {
  @ApiProperty() fila!: number;
  @ApiProperty() codigo!: string;
  @ApiProperty({ enum: ['NUEVO', 'ACTUALIZA'] }) estado!: 'NUEVO' | 'ACTUALIZA';
  @ApiProperty({ type: ProductoCreateBodyDto }) datos!: ProductoCreateBodyDto;
}

export class ImportacionProductosConfirmBodyDto {
  @ApiProperty({ type: FilaConfirmDto, isArray: true, minItems: 1, maxItems: 5000 })
  filas!: FilaConfirmDto[];
}

export class DetalleOmitidoDto {
  @ApiProperty() fila!: number;
  @ApiProperty() codigo!: string;
  @ApiProperty() motivo!: string;
}

export class ResultadoImportacionProductosDto {
  @ApiProperty() creados!: number;
  @ApiProperty() actualizados!: number;
  @ApiProperty() omitidos!: number;
  @ApiProperty({ type: DetalleOmitidoDto, isArray: true }) detalles!: DetalleOmitidoDto[];
}
