import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiPaymentRequiredResponse,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  type ImportacionProductosConfirm,
  ImportacionProductosConfirmSchema,
  LIMITE_BYTES_IMPORTACION,
  type ResultadoImportacionProductos,
  type VistaPreviaImportacion,
} from '@inventariosmart/shared';
import { memoryStorage } from 'multer';
import { Roles } from '../common/decorators/roles.decorator';
import { ApiErrorDto } from '../common/dto/api-error.dto';
import { validacion } from '../common/errors';
import { ZodValidationPipe } from '../common/pipes/zod-validation.pipe';
import {
  ArchivoProductosDto,
  ImportacionProductosConfirmBodyDto,
  ResultadoImportacionProductosDto,
  VistaPreviaImportacionDto,
} from './import.dto';
import { ImportService } from './import.service';

@ApiTags('importacion')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ type: ApiErrorDto })
@ApiForbiddenResponse({ type: ApiErrorDto, description: 'Sólo el DUENIO importa' })
@Roles('DUENIO')
@Controller('import')
export class ImportController {
  constructor(private readonly importacion: ImportService) {}

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('archivo', {
      storage: memoryStorage(),
      limits: { fileSize: LIMITE_BYTES_IMPORTACION * 2, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Vista previa de una planilla de productos (.xlsx o .csv)',
    description:
      'Valida cada fila con las reglas del alta de producto y la clasifica: NUEVO, ACTUALIZA (el código existe) o INVALIDA. Informa si la importación superaría el límite del plan. No registra nada.',
  })
  @ApiBody({ type: ArchivoProductosDto })
  @ApiOkResponse({ type: VistaPreviaImportacionDto })
  @ApiBadRequestResponse({
    type: ApiErrorDto,
    description: 'Archivo inválido, sin columnas obligatorias o demasiado grande',
  })
  vistaPrevia(
    @UploadedFile() archivo: Express.Multer.File | undefined,
  ): Promise<VistaPreviaImportacion> {
    if (!archivo)
      throw validacion('Adjuntá la planilla en el campo "archivo".', {
        archivo: 'Falta el archivo.',
      });
    if (archivo.size > LIMITE_BYTES_IMPORTACION)
      throw validacion('El archivo supera los 2 MB.', { archivo: 'Máximo 2 MB.' });
    return this.importacion.vistaPrevia(archivo.buffer, archivo.originalname);
  }

  @Post('commit')
  @ApiOperation({
    summary: 'Confirmar la importación de productos',
    description:
      'Crea los nuevos con su INGRESO de stock inicial y actualiza los existentes sin tocar el stock, en una sola transacción. 402 si supera el límite del plan.',
  })
  @ApiBody({ type: ImportacionProductosConfirmBodyDto })
  @ApiCreatedResponse({ type: ResultadoImportacionProductosDto })
  @ApiBadRequestResponse({ type: ApiErrorDto })
  @ApiPaymentRequiredResponse({
    type: ApiErrorDto,
    description: 'Límite de productos del plan (PLAN_REQUERIDO)',
  })
  confirmar(
    @Body(new ZodValidationPipe(ImportacionProductosConfirmSchema))
    body: ImportacionProductosConfirmBodyDto & ImportacionProductosConfirm,
  ): Promise<ResultadoImportacionProductos> {
    return this.importacion.confirmar(body);
  }
}
