import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type Gasto,
  type GastoCreate,
  GastoCreateSchema,
  type GastoPatch,
  GastoPatchSchema,
  type GastosQuery,
  GastosQuerySchema,
  type ListaGastosMes,
  PERIODICIDADES,
  type ResumenGastos,
  TIPOS_GASTO,
} from '@inventariosmart/shared';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  GastoCreateBodyDto,
  GastoDto,
  GastoPatchBodyDto,
  ListaGastosMesDto,
  ResumenGastosDto,
} from './expenses.dto';
import { ExpensesService } from './expenses.service';

const UUID_V4 = new ParseUUIDPipe({ version: '4' });

@ApiTags('gastos')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'EMPLEADO sin acceso; CONTADOR sólo lectura',
})
@Roles('DUENIO', 'CONTADOR')
@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  @ApiOperation({
    summary: 'Gastos que aplican a un mes, con totales',
    description:
      'Incluye los únicos del mes, los mensuales vigentes y los anuales prorrateados en doceavos. Sin periodo, el mes actual.',
  })
  @ApiQuery({ name: 'periodo', required: false, example: '2026-09' })
  @ApiQuery({ name: 'tipo', required: false, enum: TIPOS_GASTO })
  @ApiOkResponse({ type: ListaGastosMesDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Mes inválido' })
  listarMes(
    @Query(new ZodValidationPipe(GastosQuerySchema)) query: GastosQuery,
  ): Promise<ListaGastosMes> {
    return this.expenses.listarMes(query);
  }

  @Get('summary')
  @ApiOperation({
    summary: 'Prorrateo del mes (RN-02)',
    description:
      'Total de gastos, unidades vendidas (ventas no anuladas del mes) y gasto por unidad; null con motivo SIN_GASTOS o SIN_VENTAS.',
  })
  @ApiQuery({ name: 'periodo', required: false, example: '2026-09' })
  @ApiOkResponse({ type: ResumenGastosDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  resumen(
    @Query(new ZodValidationPipe(GastosQuerySchema)) query: GastosQuery,
  ): Promise<ResumenGastos> {
    return this.expenses.resumen(query.periodo);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un gasto' })
  @ApiOkResponse({ type: GastoDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  obtener(@Param('id', UUID_V4) id: string): Promise<Gasto> {
    return this.expenses.obtener(id);
  }

  @Post()
  @Roles('DUENIO')
  @ApiOperation({
    summary: 'Cargar un gasto',
    description: `Periodicidad: ${PERIODICIDADES.join(', ')}.`,
  })
  @ApiBody({ type: GastoCreateBodyDto })
  @ApiCreatedResponse({ type: GastoDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'VALIDACION con details por campo' })
  crear(
    @Body(new ZodValidationPipe(GastoCreateSchema)) body: GastoCreateBodyDto & GastoCreate,
  ): Promise<Gasto> {
    return this.expenses.crear(body);
  }

  @Patch(':id')
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Editar un gasto' })
  @ApiBody({ type: GastoPatchBodyDto })
  @ApiOkResponse({ type: GastoDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  actualizar(
    @Param('id', UUID_V4) id: string,
    @Body(new ZodValidationPipe(GastoPatchSchema)) body: GastoPatchBodyDto & GastoPatch,
  ): Promise<Gasto> {
    return this.expenses.actualizar(id, body);
  }

  @Delete(':id')
  @Roles('DUENIO')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Eliminar un gasto' })
  @ApiNoContentResponse()
  @ApiNotFoundResponse({ type: ApiErrorDto })
  eliminar(@Param('id', UUID_V4) id: string): Promise<void> {
    return this.expenses.eliminar(id);
  }
}
