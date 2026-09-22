import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MOTIVOS_RESUMEN, PERIODICIDADES, TIPOS_GASTO } from '@inventariosmart/shared';

export class UsuarioResumenGastoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ nullable: true, type: String })
  nombre!: string | null;
}

export class GastoDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ example: 'Alquiler' })
  concepto!: string;

  @ApiProperty({ enum: TIPOS_GASTO })
  tipo!: 'FIJO' | 'VARIABLE';

  @ApiProperty({ description: 'Importe neto sin IVA, decimal como string', example: '250000.00' })
  importe!: string;

  @ApiProperty({ description: 'Mes de inicio, YYYY-MM', example: '2026-09' })
  periodo!: string;

  @ApiProperty({ enum: PERIODICIDADES })
  periodicidad!: 'UNICO' | 'MENSUAL' | 'ANUAL';

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'Último mes en que aplica (sólo recurrentes), YYYY-MM',
  })
  fin!: string | null;

  @ApiProperty({ nullable: true, type: String })
  notas!: string | null;

  @ApiProperty({ type: UsuarioResumenGastoDto })
  usuario!: UsuarioResumenGastoDto;

  @ApiProperty({ format: 'date-time' })
  creadoEn!: string;

  @ApiProperty({ format: 'date-time' })
  actualizadoEn!: string;
}

export class GastoDelMesDto extends GastoDto {
  @ApiProperty({
    description: 'Lo que aporta al mes consultado: completo, o un doceavo si es ANUAL',
    example: '250000.00',
  })
  importeMes!: string;
}

export class TotalesGastosDto {
  @ApiProperty({ example: '260000.00' }) fijos!: string;
  @ApiProperty({ example: '30000.00' }) variables!: string;
  @ApiProperty({ example: '290000.00' }) total!: string;
}

export class ListaGastosMesDto {
  @ApiProperty({ example: '2026-09' })
  periodo!: string;

  @ApiProperty({ type: GastoDelMesDto, isArray: true })
  items!: GastoDelMesDto[];

  @ApiProperty({ type: TotalesGastosDto })
  totales!: TotalesGastosDto;
}

export class ResumenGastosDto {
  @ApiProperty({ example: '2026-09' })
  periodo!: string;

  @ApiProperty({ example: '260000.00' })
  totalFijos!: string;

  @ApiProperty({ example: '30000.00' })
  totalVariables!: string;

  @ApiProperty({ example: '290000.00' })
  total!: string;

  @ApiProperty({ description: 'Ventas no anuladas con fecha en el mes', example: 145 })
  unidadesVendidas!: number;

  @ApiProperty({
    nullable: true,
    type: String,
    description: 'total / unidadesVendidas (RN-02), o null con motivo',
    example: '2000.00',
  })
  gastoPorUnidad!: string | null;

  @ApiProperty({ nullable: true, enum: MOTIVOS_RESUMEN })
  motivo!: 'SIN_GASTOS' | 'SIN_VENTAS' | null;
}

export class GastoCreateBodyDto {
  @ApiProperty({ minLength: 2, maxLength: 120, example: 'Alquiler' })
  concepto!: string;

  @ApiProperty({ enum: TIPOS_GASTO })
  tipo!: 'FIJO' | 'VARIABLE';

  @ApiProperty({
    description: 'Neto sin IVA; número o string decimal, mayor a 0',
    example: '250000',
  })
  importe!: string;

  @ApiProperty({ description: 'Mes de inicio, YYYY-MM', example: '2026-09' })
  periodo!: string;

  @ApiProperty({ enum: PERIODICIDADES })
  periodicidad!: 'UNICO' | 'MENSUAL' | 'ANUAL';

  @ApiPropertyOptional({
    nullable: true,
    type: String,
    description: 'Último mes (YYYY-MM); sólo para MENSUAL o ANUAL',
  })
  fin?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 300 })
  notas?: string | null;
}

export class GastoPatchBodyDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 120 })
  concepto?: string;

  @ApiPropertyOptional({ enum: TIPOS_GASTO })
  tipo?: 'FIJO' | 'VARIABLE';

  @ApiPropertyOptional({ example: '260000' })
  importe?: string;

  @ApiPropertyOptional({ example: '2026-09' })
  periodo?: string;

  @ApiPropertyOptional({ enum: PERIODICIDADES })
  periodicidad?: 'UNICO' | 'MENSUAL' | 'ANUAL';

  @ApiPropertyOptional({ nullable: true, type: String, description: 'null quita el fin' })
  fin?: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, maxLength: 300 })
  notas?: string | null;
}
