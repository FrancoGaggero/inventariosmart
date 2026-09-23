import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { type Dashboard, GastosQuerySchema, type GastosQuery } from '@inventariosmart/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import { DashboardDto } from './dashboard.dto';
import { DashboardService } from './dashboard.service';

@ApiTags('dashboard')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'EMPLEADO sin acceso (Propuesta §2.4)' })
@Roles('DUENIO', 'CONTADOR')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Panel financiero del mes',
    description:
      'Stock, ventas y márgenes del mes con comparación contra el mes anterior, productos más rentables y alertas activas, en una sola respuesta calculada en el momento (RF-05, RNF-04).',
  })
  @ApiQuery({ name: 'periodo', required: false, example: '2026-09' })
  @ApiOkResponse({ type: DashboardDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  obtener(@Query(new ZodValidationPipe(GastosQuerySchema)) query: GastosQuery): Promise<Dashboard> {
    return this.dashboard.obtener(query.periodo);
  }
}
