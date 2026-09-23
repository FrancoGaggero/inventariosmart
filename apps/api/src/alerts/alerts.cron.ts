import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { TenantContext } from '../auth/tenant-context';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { AlertsService } from './alerts.service';

/** Cron diario a las 07:00 de Buenos Aires (design D4). */
export const CRON_ALERTAS = '0 7 * * *';
export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires';

/**
 * Recalcula las alertas de todos los comercios con plan PRO o superior. En Render Free la
 * instancia dormida no lo ejecuta; el recálculo bajo demanda cubre ese caso.
 */
@Injectable()
export class AlertsCron {
  private readonly logger = new Logger(AlertsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly alerts: AlertsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CRON_ALERTAS, { name: 'alertas-reposicion', timeZone: ZONA_HORARIA })
  async diario(): Promise<void> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    const r = await this.correr();
    this.logger.log(r, 'Recálculo diario de alertas de reposición');
  }

  /** Recorre los comercios PRO/PREMIUM y recalcula cada uno con su contexto de tenant. */
  async correr(): Promise<{ comercios: number; creadas: number; fallidos: number }> {
    const comercios = await this.prisma.comoSistema((tx) =>
      tx.comercio.findMany({
        where: { plan: { in: ['PRO', 'PREMIUM'] } },
        select: { id: true, plan: true },
      }),
    );
    let creadas = 0;
    let fallidos = 0;
    for (const c of comercios) {
      try {
        const r = await TenantContext.correr(
          { comercioId: c.id, usuarioId: 'cron', rol: 'DUENIO', plan: c.plan },
          () => this.alerts.recalcular(),
        );
        creadas += r?.creadas ?? 0;
      } catch (err) {
        fallidos += 1;
        this.logger.warn({ err, comercioId: c.id }, 'Falló el recálculo de un comercio');
      }
    }
    return { comercios: comercios.length, creadas, fallidos };
  }
}
