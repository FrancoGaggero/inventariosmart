import { Controller, Get } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Indicadores } from '@inventariosmart/shared';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { IndicadoresDto } from './indicators.dto';
import { IndicatorsService } from './indicators.service';

@ApiTags('indicadores')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@Controller('indicators')
export class IndicatorsController {
  constructor(private readonly indicators: IndicatorsService) {}

  @Get()
  @ApiOperation({
    summary: 'Indicadores económicos oficiales (HU-15)',
    description:
      'Inflación mensual e interanual y dólar minorista (BCRA) e índice de precios al consumidor (INDEC), con la fecha y la fuente de cada dato. Disponible para todos los roles y planes. Si una fuente no responde, devuelve el último dato guardado con `desactualizado: true`.',
  })
  @ApiOkResponse({ type: IndicadoresDto })
  obtener(): Promise<Indicadores> {
    return this.indicators.obtener();
  }
}
