import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';
import { CODIGOS_ERROR, type ApiError, type CodigoError } from '@inventariosmart/shared';
import { Logger } from 'nestjs-pino';

const CODIGO_POR_STATUS: Record<number, CodigoError> = {
  400: CODIGOS_ERROR.VALIDACION,
  401: CODIGOS_ERROR.NO_AUTENTICADO,
  402: CODIGOS_ERROR.PLAN_REQUERIDO,
  403: CODIGOS_ERROR.SIN_PERMISO,
  404: CODIGOS_ERROR.NO_ENCONTRADO,
  422: CODIGOS_ERROR.VALIDACION,
};

const MENSAJE_POR_STATUS: Record<number, string> = {
  400: 'Los datos enviados no son válidos.',
  401: 'Tenés que iniciar sesión para continuar.',
  402: 'Esta función requiere un plan superior.',
  403: 'No tenés permiso para realizar esta acción.',
  404: 'No encontramos lo que buscás.',
  422: 'Los datos enviados no son válidos.',
  429: 'Demasiadas solicitudes. Esperá un momento y volvé a intentar.',
};

/**
 * Convierte cualquier excepción en la forma única { code, message, details }
 * con mensaje en español apto para mostrar al usuario (RNF-01, RNF-08).
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  constructor(private readonly logger: Logger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { status, body } = this.normalizar(exception);

    if (status >= 500) {
      this.logger.error({ err: exception }, 'Error no controlado');
    }

    res.status(status).json(body);
  }

  private normalizar(exception: unknown): { status: number; body: ApiError } {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      const custom =
        typeof payload === 'object' && payload !== null ? (payload as Partial<ApiError>) : {};
      // Sólo las excepciones propias (con `code`) traen mensaje pensado para el usuario;
      // las de Nest (p. ej. "Cannot GET /x") se reemplazan por el texto en español.
      const esPropia = typeof custom.code === 'string';
      return {
        status,
        body: {
          code: custom.code ?? CODIGO_POR_STATUS[status] ?? CODIGOS_ERROR.ERROR_INTERNO,
          message:
            (esPropia ? custom.message : undefined) ??
            MENSAJE_POR_STATUS[status] ??
            'Ocurrió un error al procesar la solicitud.',
          ...(custom.details !== undefined ? { details: custom.details } : {}),
        },
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      body: {
        code: CODIGOS_ERROR.ERROR_INTERNO,
        message:
          'Ocurrió un error inesperado. Ya quedó registrado; intentá de nuevo en unos minutos.',
      },
    };
  }
}
