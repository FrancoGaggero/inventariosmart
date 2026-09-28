import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiQuery,
  ApiServiceUnavailableResponse,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type ConversacionDetalle,
  type ConversacionesQuery,
  ConversacionesQuerySchema,
  type ListaConversaciones,
  type MensajeCreate,
  MensajeCreateSchema,
  type RespuestaAsistente,
} from '@inventariosmart/shared';
import { RequierePlan, Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ConversacionDetalleDto,
  ListaConversacionesDto,
  MensajeCreateBodyDto,
  RespuestaAsistenteDto,
} from './assistant.dto';
import { AssistantService } from './assistant.service';

@ApiTags('asistente')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({
  type: ApiErrorDto,
  description: 'Sólo el dueño: el asistente ve costos y márgenes',
})
@ApiPaymentRequiredResponse({
  type: ApiErrorDto,
  description: 'Planes FREE y PRO: el asistente requiere PREMIUM (RN-09)',
})
@Controller('assistant')
@RequierePlan('PREMIUM')
@Roles('DUENIO')
export class AssistantController {
  constructor(private readonly asistente: AssistantService) {}

  @Post('messages')
  @ApiOperation({
    summary: 'Enviar una consulta al asistente (HU-08)',
    description:
      'El asistente responde con datos del comercio, que obtiene de consultas predefinidas (`fuentes`). No modifica datos: a lo sumo deja una orden de compra en borrador (`acciones`), que el dueño confirma desde Órdenes (RN-06).',
  })
  @ApiBody({ type: MensajeCreateBodyDto })
  @ApiCreatedResponse({ type: RespuestaAsistenteDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiNotFoundResponse({ type: ApiErrorDto, description: 'La conversación no es del usuario' })
  @ApiTooManyRequestsResponse({
    type: ApiErrorDto,
    description: 'LIMITE_ALCANZADO: tope diario de consultas del comercio',
  })
  @ApiServiceUnavailableResponse({
    type: ApiErrorDto,
    description:
      'SERVICIO_NO_DISPONIBLE: el proveedor de IA no está configurado o no responde. No descuenta del límite diario',
  })
  responder(
    @Body(new ZodValidationPipe(MensajeCreateSchema)) dto: MensajeCreate,
  ): Promise<RespuestaAsistente> {
    return this.asistente.responder(dto);
  }

  @Get('conversations')
  @ApiOperation({ summary: 'Conversaciones del usuario, de la más reciente a la más antigua' })
  @ApiQuery({ name: 'cursor', required: false })
  @ApiQuery({ name: 'limit', required: false, example: 25 })
  @ApiOkResponse({ type: ListaConversacionesDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  listar(
    @Query(new ZodValidationPipe(ConversacionesQuerySchema)) query: ConversacionesQuery,
  ): Promise<ListaConversaciones> {
    return this.asistente.listar(query);
  }

  @Get('conversations/:id')
  @ApiOperation({ summary: 'Mensajes de una conversación, en orden' })
  @ApiOkResponse({ type: ConversacionDetalleDto })
  @ApiNotFoundResponse({ type: ApiErrorDto })
  obtener(
    @Param('id', new ParseUUIDPipe({ version: '4' })) id: string,
  ): Promise<ConversacionDetalle> {
    return this.asistente.obtener(id);
  }
}
