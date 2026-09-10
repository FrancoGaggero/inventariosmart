import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PLANES } from '@inventariosmart/shared';

export class ComercioDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Repuestos Carlos' })
  nombre!: string;

  @ApiProperty({ nullable: true, type: String, example: '20123456789' })
  cuit!: string | null;

  @ApiProperty({ enum: PLANES })
  plan!: 'FREE' | 'PRO' | 'PREMIUM';

  @ApiProperty({ description: 'Alícuota de IVA por defecto (%), decimal como string', example: '21' })
  ivaDefault!: string;

  @ApiProperty({ example: 'ARS' })
  moneda!: string;

  @ApiProperty({ description: 'true hasta que el dueño confirma el nombre del comercio' })
  onboardingPendiente!: boolean;
}

export class ComercioPatchBodyDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  nombre?: string;

  @ApiPropertyOptional({ nullable: true, type: String, description: '11 dígitos sin guiones, o null' })
  cuit?: string | null;

  @ApiPropertyOptional({ minimum: 0, maximum: 100, example: 21 })
  ivaDefault?: number;
}
