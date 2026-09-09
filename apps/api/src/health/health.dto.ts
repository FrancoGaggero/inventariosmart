import { ApiProperty } from '@nestjs/swagger';

/** DTO sólo para documentar la respuesta en OpenAPI; el tipo real vive en @inventariosmart/shared. */
export class HealthDto {
  @ApiProperty({ enum: ['ok'] })
  status!: 'ok';

  @ApiProperty({ enum: ['ok', 'error'], description: 'Resultado de SELECT 1 contra PostgreSQL' })
  db!: 'ok' | 'error';

  @ApiProperty({ example: '0.1.0' })
  version!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}
