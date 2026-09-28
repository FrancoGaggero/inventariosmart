import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ZONA_HORARIA } from '../alerts/alerts.cron';
import type { Env } from '../config/env';
import { IndicatorsService } from './indicators.service';

/** Todos los días a las 09:00 de Buenos Aires (design D4). */
export const CRON_INDICADORES = '0 9 * * *';

/**
 * Actualiza los indicadores una vez por día. Si Render está dormido a esa hora, la primera
 * consulta del día los actualiza bajo demanda.
 */
@Injectable()
export class IndicatorsCron {
  constructor(
    private readonly indicators: IndicatorsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CRON_INDICADORES, { name: 'indicadores-economicos', timeZone: ZONA_HORARIA })
  async diario(): Promise<void> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    await this.indicators.actualizar(true);
  }
}
