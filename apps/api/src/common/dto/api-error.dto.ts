import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** Forma única de error de la API (documentación OpenAPI). */
export class ApiErrorDto {
  @ApiProperty({
    example: 'SIN_PERMISO',
    enum: [
      'NO_AUTENTICADO',
      'SIN_PERMISO',
      'PLAN_REQUERIDO',
      'NO_ENCONTRADO',
      'CONFLICTO',
      'VALIDACION',
      'ERROR_INTERNO',
    ],
  })
  code!: string;

  @ApiProperty({ example: 'No tenés permiso para realizar esta acción.' })
  message!: string;

  @ApiPropertyOptional({ description: 'Detalle adicional: campo → mensaje, o planMinimo.' })
  details?: unknown;
}
