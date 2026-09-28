import { ApiProperty } from '@nestjs/swagger';

export class IndicadorValorDto {
  @ApiProperty({ example: '1.70' }) valor!: string;
  @ApiProperty({ description: 'Fecha del dato', example: '2026-08-31' }) fecha!: string;
  @ApiProperty({ example: 'BCRA' }) fuente!: string;
}

export class IndicadorIpcDto {
  @ApiProperty({ description: 'Nivel del índice, base diciembre 2016', example: '12276.77' })
  valor!: string;
  @ApiProperty({ example: '2026-08' }) periodo!: string;
  @ApiProperty({ example: 'INDEC' }) fuente!: string;
}

export class IndicadoresDto {
  @ApiProperty({ type: IndicadorValorDto, nullable: true, description: 'Inflación del mes, en %' })
  inflacionMensual!: IndicadorValorDto | null;
  @ApiProperty({
    type: IndicadorValorDto,
    nullable: true,
    description: 'Inflación interanual, en %',
  })
  inflacionInteranual!: IndicadorValorDto | null;
  @ApiProperty({
    type: IndicadorValorDto,
    nullable: true,
    description: 'Tipo de cambio minorista, pesos por dólar',
  })
  dolarMinorista!: IndicadorValorDto | null;
  @ApiProperty({ type: IndicadorIpcDto, nullable: true }) ipc!: IndicadorIpcDto | null;
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'date-time',
    description: 'Última actualización completa desde las fuentes',
  })
  actualizadoEn!: string | null;
  @ApiProperty({
    description: 'La última consulta a alguna fuente falló o el dato tiene más de 48 horas',
  })
  desactualizado!: boolean;
}
