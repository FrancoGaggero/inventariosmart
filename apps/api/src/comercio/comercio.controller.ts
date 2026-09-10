import { Body, Controller, Get, Patch } from '@nestjs/common';
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
import { type Comercio, type ComercioPatch, ComercioPatchSchema } from '@inventariosmart/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { ComercioDto, ComercioPatchBodyDto } from './comercio.dto';
import { ComercioService } from './comercio.service';

@ApiTags('comercio')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Rol sin permiso (SIN_PERMISO)' })
@Controller('comercio')
export class ComercioController {
  constructor(private readonly comercios: ComercioService) {}

  @Get()
  @Roles('DUENIO', 'CONTADOR')
  @ApiOperation({ summary: 'Datos del comercio del usuario autenticado' })
  @ApiOkResponse({ type: ComercioDto })
  obtener(): Promise<Comercio> {
    return this.comercios.obtener();
  }

  @Patch()
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Actualizar nombre, CUIT o IVA por defecto del comercio' })
  @ApiBody({ type: ComercioPatchBodyDto })
  @ApiOkResponse({ type: ComercioDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'VALIDACION con details por campo' })
  actualizar(
    @Body(new ZodValidationPipe(ComercioPatchSchema)) body: ComercioPatchBodyDto & ComercioPatch,
  ): Promise<Comercio> {
    return this.comercios.actualizar(body);
  }
}
