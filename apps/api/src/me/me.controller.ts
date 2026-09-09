import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Me } from '@inventariosmart/shared';
import { type AuthUser, CurrentUser } from '../common/decorators/current-user.decorator';
import { MeDto } from './me.dto';

/**
 * Sprint 0: prueba de humo de la cadena Firebase → API. Devuelve la identidad del token.
 * La change auth-tenancy reemplaza esta respuesta por usuario + comercio + rol + plan (HU-11).
 */
@ApiTags('auth')
@ApiBearerAuth()
@Controller('me')
export class MeController {
  @Get()
  @ApiOperation({ summary: 'Identidad del usuario autenticado' })
  @ApiOkResponse({ type: MeDto })
  @ApiUnauthorizedResponse({
    description: 'Sin token o token inválido: { code: "NO_AUTENTICADO" }',
  })
  me(@CurrentUser() user: AuthUser): Me {
    return { uid: user.uid, email: user.email };
  }
}
