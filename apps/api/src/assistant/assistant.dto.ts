import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ASISTENTE_MAX_CARACTERES, ROLES_MENSAJE, type RolMensaje } from '@inventariosmart/shared';

export class MensajeCreateBodyDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Conversación a continuar; sin indicarla se abre una nueva',
  })
  conversacionId?: string;

  @ApiProperty({
    maxLength: ASISTENTE_MAX_CARACTERES,
    example: '¿Cuál fue el producto más rentable de la quincena?',
  })
  mensaje!: string;
}

export class FuenteAsistenteDto {
  @ApiProperty({ example: 'productos_mas_rentables' }) herramienta!: string;
  @ApiProperty({ example: 'Productos más rentables' }) nombre!: string;
}

export class AccionAsistenteDto {
  @ApiProperty({ enum: ['ORDEN_BORRADOR'] }) tipo!: 'ORDEN_BORRADOR';
  @ApiProperty({ format: 'uuid' }) ordenId!: string;
  @ApiProperty({ example: 'OC-0007' }) numero!: string;
  @ApiProperty({ example: 'Distribuidora Norte' }) proveedor!: string;
}

export class MensajeAsistenteDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: ROLES_MENSAJE }) rol!: RolMensaje;
  @ApiProperty() contenido!: string;
  @ApiProperty({
    type: FuenteAsistenteDto,
    isArray: true,
    description: 'Consultas al sistema que hizo el asistente para responder',
  })
  fuentes!: FuenteAsistenteDto[];
  @ApiProperty({
    type: AccionAsistenteDto,
    isArray: true,
    description: 'Lo que el asistente dejó preparado para que el dueño revise (RN-06)',
  })
  acciones!: AccionAsistenteDto[];
  @ApiProperty({ format: 'date-time' }) creadoEn!: string;
}

export class RespuestaAsistenteDto {
  @ApiProperty({ format: 'uuid' }) conversacionId!: string;
  @ApiProperty({ type: MensajeAsistenteDto, description: 'Respuesta del asistente' })
  mensaje!: MensajeAsistenteDto;
}

export class ConversacionDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: '¿Cuál fue el producto más rentable de la quincena?' })
  titulo!: string;
  @ApiProperty({ format: 'date-time' }) creadoEn!: string;
  @ApiProperty({ format: 'date-time', description: 'Fecha del último mensaje' })
  actualizadoEn!: string;
}

export class ListaConversacionesDto {
  @ApiProperty({ type: ConversacionDto, isArray: true }) items!: ConversacionDto[];
  @ApiProperty({ nullable: true, type: String }) siguienteCursor!: string | null;
}

export class ConversacionDetalleDto extends ConversacionDto {
  @ApiProperty({ type: MensajeAsistenteDto, isArray: true }) mensajes!: MensajeAsistenteDto[];
}
