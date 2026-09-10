import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ESTADOS_USUARIO, ROLES } from '@inventariosmart/shared';

export class UsuarioDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'ana@repuestoscarlos.com.ar' })
  email!: string;

  @ApiProperty({ nullable: true, type: String })
  nombre!: string | null;

  @ApiProperty({ enum: ROLES })
  rol!: 'DUENIO' | 'EMPLEADO' | 'CONTADOR';

  @ApiProperty()
  activo!: boolean;

  @ApiProperty({
    enum: ESTADOS_USUARIO,
    description: 'INVITADO: todavía no inició sesión; ACTIVO; INACTIVO: dado de baja',
  })
  estado!: 'INVITADO' | 'ACTIVO' | 'INACTIVO';

  @ApiProperty({ format: 'date-time' })
  creadoEn!: string;
}

export class InvitacionBodyDto {
  @ApiProperty({ format: 'email', example: 'ana@repuestoscarlos.com.ar' })
  email!: string;

  @ApiProperty({ enum: ROLES })
  rol!: 'DUENIO' | 'EMPLEADO' | 'CONTADOR';
}

export class UsuarioPatchBodyDto {
  @ApiPropertyOptional({ enum: ROLES })
  rol?: 'DUENIO' | 'EMPLEADO' | 'CONTADOR';

  @ApiPropertyOptional({ description: 'false = dar de baja; true = reactivar' })
  activo?: boolean;
}
