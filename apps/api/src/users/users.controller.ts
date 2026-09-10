import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type Invitacion,
  InvitacionSchema,
  type Usuario,
  type UsuarioPatch,
  UsuarioPatchSchema,
} from '@inventariosmart/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { InvitacionBodyDto, UsuarioDto, UsuarioPatchBodyDto } from './users.dto';
import { UsersService } from './users.service';

@ApiTags('usuarios')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Sólo el DUENIO administra usuarios' })
@Roles('DUENIO')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: 'Usuarios del comercio (dueños, invitados, activos e inactivos)' })
  @ApiOkResponse({ type: UsuarioDto, isArray: true })
  listar(): Promise<Usuario[]> {
    return this.users.listar();
  }

  @Post()
  @ApiOperation({
    summary: 'Invitar a un usuario por email',
    description:
      'La persona invitada inicia sesión con ese email (Google o contraseña) y queda vinculada al comercio. Cuenta para el límite de usuarios del plan.',
  })
  @ApiBody({ type: InvitacionBodyDto })
  @ApiCreatedResponse({ type: UsuarioDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiConflictResponse({ type: ApiErrorDto, description: 'Email ya en uso (CONFLICTO)' })
  @ApiPaymentRequiredResponse({
    type: ApiErrorDto,
    description: 'Límite de usuarios del plan (PLAN_REQUERIDO, details.planMinimo)',
  })
  invitar(
    @Body(new ZodValidationPipe(InvitacionSchema)) body: InvitacionBodyDto & Invitacion,
  ): Promise<Usuario> {
    return this.users.invitar(body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cambiar el rol o dar de baja / reactivar a un usuario' })
  @ApiBody({ type: UsuarioPatchBodyDto })
  @ApiOkResponse({ type: UsuarioDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'VALIDACION, incluido "el comercio necesita al menos un dueño activo"',
  })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  actualizar(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
    @Body(new ZodValidationPipe(UsuarioPatchSchema)) body: UsuarioPatchBodyDto & UsuarioPatch,
  ): Promise<Usuario> {
    return this.users.actualizar(id, body);
  }
}
