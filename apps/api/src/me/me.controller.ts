import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Me, type Onboarding, OnboardingSchema } from '@inventariosmart/shared';
import { ComercioService } from '../comercio/comercio.service';
import { type AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { MeDto, OnboardingBodyDto } from './me.dto';

function aMe(user: AuthUser, comercio = user.comercio): Me {
  return {
    usuario: {
      id: user.usuarioId,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      activo: user.activo,
      estado: user.activo ? 'ACTIVO' : 'INACTIVO',
      creadoEn: user.creadoEn.toISOString(),
    },
    comercio,
    rol: user.rol,
    plan: comercio.plan,
    onboardingPendiente: comercio.onboardingPendiente,
  };
}

@ApiTags('auth')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto, description: 'Sin token o token inválido' })
@Controller('me')
export class MeController {
  constructor(private readonly comercios: ComercioService) {}

  @Get()
  @ApiOperation({
    summary: 'Usuario autenticado, su comercio, rol y plan',
    description:
      'En el primer ingreso de una identidad crea el comercio (plan FREE) y el usuario DUENIO; si el email tenía una invitación pendiente, la vincula.',
  })
  @ApiOkResponse({ type: MeDto })
  @ApiForbiddenResponse({ type: ApiErrorDto, description: 'Usuario dado de baja' })
  me(@CurrentUser() user: AuthUser): Me {
    return aMe(user);
  }

  @Post('onboarding')
  @HttpCode(200)
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Confirmar el nombre del comercio elegido en el registro' })
  @ApiBody({ type: OnboardingBodyDto })
  @ApiOkResponse({ type: MeDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiForbiddenResponse({ type: ApiErrorDto })
  async onboarding(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(OnboardingSchema)) body: OnboardingBodyDto & Onboarding,
  ): Promise<Me> {
    const comercio = await this.comercios.onboarding(body.nombreComercio);
    return aMe(user, comercio);
  }
}
