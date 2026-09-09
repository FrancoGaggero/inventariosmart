import { HttpException, HttpStatus } from '@nestjs/common';
import { CODIGOS_ERROR, type ApiError } from '@inventariosmart/shared';

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
