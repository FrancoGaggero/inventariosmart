import {
  Body,
  Controller,
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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type AjustesReportes,
  type AjustesReportesPatch,
  AjustesReportesPatchSchema,
  type GenerarReporte,
  GenerarReporteSchema,
  type ListaReportes,
  type ReporteSemanal,
  type ReportesQuery,
  ReportesQuerySchema,
} from '@inventariosmart/shared';
import { RequierePlan, Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  AjustesReportesDto,
  AjustesReportesPatchBodyDto,
  GenerarReporteBodyDto,
  ListaReportesDto,
  ReporteSemanalDto,
} from './reports.dto';
import { ReportsService } from './reports.service';

const UUID_V4 = new ParseUUIDPipe({ version: '4' });

@ApiTags('reportes')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'EMPLEADO sin acceso; CONTADOR sólo lectura',
})
@ApiPaymentRequiredResponse({
  type: ApiErrorDto,
  description: 'Plan FREE: los reportes requieren PRO (PLAN_REQUERIDO)',
})
@Controller('reports')
@RequierePlan('PRO')
@Roles('DUENIO', 'CONTADOR')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('settings')
  @ApiOperation({ summary: 'Ajustes del reporte semanal: activo y destinatarios extra' })
  @ApiOkResponse({ type: AjustesReportesDto })
  ajustes(): Promise<AjustesReportes> {
    return this.reports.ajustes();
  }

  @Patch('settings')
  @Roles('DUENIO')
  @ApiOperation({ summary: 'Cambiar los ajustes del reporte semanal' })
  @ApiBody({ type: AjustesReportesPatchBodyDto })
  @ApiOkResponse({ type: AjustesReportesDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'VALIDACION con details por campo' })
  actualizarAjustes(
    @Body(new ZodValidationPipe(AjustesReportesPatchSchema)) body: AjustesReportesPatch,
  ): Promise<AjustesReportes> {
    return this.reports.actualizarAjustes(body);
  }

  @Get('weekly')
  @ApiOperation({
    summary: 'Reportes semanales, del más reciente al más antiguo (HU-09)',
    description:
      'Si falta el reporte de la última semana cerrada y los reportes están activos, lo genera y envía antes de responder.',
  })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 12 })
  @ApiOkResponse({ type: ListaReportesDto })
  listar(
    @Query(new ZodValidationPipe(ReportesQuerySchema)) query: ReportesQuery,
  ): Promise<ListaReportes> {
    return this.reports.listar(query);
  }

  @Post('weekly/generate')
  @Roles('DUENIO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Generar o regenerar el reporte de una semana (default: la semana en curso)',
    description:
      'Regenerar reemplaza el contenido sin reenviar el correo; con `enviar: true` se envía igual. Un reporte nuevo se envía si los reportes están activos.',
  })
  @ApiBody({ type: GenerarReporteBodyDto })
  @ApiOkResponse({ type: ReporteSemanalDto })
  @ApiBadRequestResponse({ type: ApiErrorDto, description: 'Semana inválida (VALIDACION)' })
  async generar(
    @Body(new ZodValidationPipe(GenerarReporteSchema)) body: GenerarReporte,
  ): Promise<ReporteSemanal> {
    const semana = body.semana ?? this.reports.semanaActual();
    const modo = body.enviar
      ? 'siempre'
      : (await this.reports.ajustes()).activo
        ? 'siNoEnviado'
        : 'nunca';
    return this.reports.generar(semana, modo);
  }

  @Get('weekly/:id')
  @ApiOperation({ summary: 'Detalle de un reporte con su contenido' })
  @ApiOkResponse({ type: ReporteSemanalDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  obtener(@Param('id', UUID_V4) id: string): Promise<ReporteSemanal> {
    return this.reports.obtener(id);
  }

  @Post('weekly/:id/resend')
  @Roles('DUENIO')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reenviar un reporte por correo' })
  @ApiOkResponse({ type: ReporteSemanalDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  reenviar(@Param('id', UUID_V4) id: string): Promise<ReporteSemanal> {
    return this.reports.reenviar(id);
  }
}
