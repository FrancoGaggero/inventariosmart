import { ApiProperty } from '@nestjs/swagger';
import { PLANES, type Plan } from '@inventariosmart/shared';

export class CambioPlanBodyDto {
  @ApiProperty({ enum: PLANES, example: 'PRO' }) plan!: Plan;
}

export class LimitesPlanDto {
  @ApiProperty({ nullable: true, type: Number, example: 50, description: 'null: sin tope' })
  productos!: number | null;
  @ApiProperty({ nullable: true, type: Number, example: 1, description: 'null: sin tope' })
  usuarios!: number | null;
}

export class UsoPlanDto {
  @ApiProperty({ example: 12, description: 'Productos activos' }) productos!: number;
  @ApiProperty({ example: 3, description: 'Usuarios activos, incluidos los invitados' })
  usuarios!: number;
}

export class FuncionalidadPlanDto {
  @ApiProperty({ example: 'alertas' }) clave!: string;
  @ApiProperty({ example: 'Alertas de reposición' }) nombre!: string;
  @ApiProperty() descripcion!: string;
  @ApiProperty({ enum: PLANES, description: 'Plan más bajo que la incluye' }) planMinimo!: Plan;
  @ApiProperty({ description: 'El plan vigente la incluye' }) incluida!: boolean;
}

export class PlanDetalleDto {
  @ApiProperty({ enum: PLANES }) plan!: Plan;
  @ApiProperty({ type: LimitesPlanDto }) limites!: LimitesPlanDto;
  @ApiProperty({ type: UsoPlanDto }) uso!: UsoPlanDto;
  @ApiProperty({ type: FuncionalidadPlanDto, isArray: true })
  funcionalidades!: FuncionalidadPlanDto[];
}

export class UsuarioCambioPlanDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ nullable: true, type: String }) nombre!: string | null;
}

export class RegistroCambioPlanDto {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ enum: PLANES }) planAnterior!: Plan;
  @ApiProperty({ enum: PLANES }) planNuevo!: Plan;
  @ApiProperty({ type: UsuarioCambioPlanDto }) usuario!: UsuarioCambioPlanDto;
  @ApiProperty({ format: 'date-time' }) creadoEn!: string;
}

export class HistorialPlanDto {
  @ApiProperty({ type: RegistroCambioPlanDto, isArray: true }) items!: RegistroCambioPlanDto[];
  @ApiProperty({ nullable: true, type: String }) siguienteCursor!: string | null;
}
