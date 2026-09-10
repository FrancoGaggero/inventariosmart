import { ApiProperty } from '@nestjs/swagger';
import { PLANES, ROLES } from '@inventariosmart/shared';
import { ComercioDto } from '../comercio/comercio.dto';
import { UsuarioDto } from '../users/users.dto';

export class MeDto {
  @ApiProperty({ type: UsuarioDto })
  usuario!: UsuarioDto;

  @ApiProperty({ type: ComercioDto })
  comercio!: ComercioDto;

  @ApiProperty({ enum: ROLES })
  rol!: 'DUENIO' | 'EMPLEADO' | 'CONTADOR';

  @ApiProperty({ enum: PLANES })
  plan!: 'FREE' | 'PRO' | 'PREMIUM';

  @ApiProperty({ description: 'true si falta confirmar el nombre del comercio' })
  onboardingPendiente!: boolean;
}

export class OnboardingBodyDto {
  @ApiProperty({ minLength: 2, maxLength: 120, example: 'Repuestos Carlos' })
  nombreComercio!: string;
}
