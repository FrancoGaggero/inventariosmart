import { HttpException, HttpStatus } from '@nestjs/common';
import { CODIGOS_ERROR, type ApiError, type Plan } from '@inventariosmart/shared';

/** Excepción con el formato del contrato ya armado. */
export class ApiHttpException extends HttpException {
  constructor(status: HttpStatus, body: ApiError) {
    super(body, status);
  }
}

export const noAutenticado = (message = 'Tenés que iniciar sesión para continuar.') =>
  new ApiHttpException(HttpStatus.UNAUTHORIZED, { code: CODIGOS_ERROR.NO_AUTENTICADO, message });

export const sinPermiso = (message = 'No tenés permiso para realizar esta acción.') =>
  new ApiHttpException(HttpStatus.FORBIDDEN, { code: CODIGOS_ERROR.SIN_PERMISO, message });

export const noEncontrado = (message = 'No encontramos lo que buscás.') =>
  new ApiHttpException(HttpStatus.NOT_FOUND, { code: CODIGOS_ERROR.NO_ENCONTRADO, message });

export const conflicto = (message: string, details?: unknown) =>
  new ApiHttpException(HttpStatus.CONFLICT, { code: CODIGOS_ERROR.CONFLICTO, message, details });

export const planRequerido = (planMinimo: Plan, message?: string) =>
  new ApiHttpException(HttpStatus.PAYMENT_REQUIRED, {
    code: CODIGOS_ERROR.PLAN_REQUERIDO,
    message: message ?? `Esta función está disponible a partir del plan ${planMinimo}.`,
    details: { planMinimo },
  });

export const validacion = (message: string, details?: Record<string, string>) =>
  new ApiHttpException(HttpStatus.BAD_REQUEST, {
    code: CODIGOS_ERROR.VALIDACION,
    message,
    details,
  });
