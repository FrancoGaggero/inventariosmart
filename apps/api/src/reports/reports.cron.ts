import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { ultimaSemanaCerrada } from '@inventariosmart/shared';
import { ZONA_HORARIA } from '../alerts/alerts.cron';
import { TenantContext } from '../auth/tenant-context';
import type { Env } from '../config/env';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

/** Lunes 08:00 de Buenos Aires (design D4). */
export const CRON_REPORTES = '0 8 * * 1';

/**
 * Genera y envía el reporte de la semana recién cerrada para los comercios PRO/PREMIUM con
 * reportes activos. Si Render está dormido, la consulta de la lista lo genera bajo demanda.
 */
@Injectable()
export class ReportsCron {
  private readonly logger = new Logger(ReportsCron.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reports: ReportsService,
    private readonly config: ConfigService<Env, true>,
  ) {}

  @Cron(CRON_REPORTES, { name: 'reportes-semanales', timeZone: ZONA_HORARIA })
  async semanal(): Promise<void> {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    const r = await this.correr();
    this.logger.log(r, 'Reportes semanales generados');
  }

  async correr(
    semana = ultimaSemanaCerrada(),
  ): Promise<{ comercios: number; generados: number; fallidos: number }> {
    const comercios = await this.prisma.comoSistema((tx) =>
      tx.comercio.findMany({
        where: { plan: { in: ['PRO', 'PREMIUM'] }, reportesActivos: true },
        select: { id: true, plan: true },
      }),
    );
    let generados = 0;
    let fallidos = 0;
    for (const c of comercios) {
      try {
        const r = await TenantContext.correr(
          { comercioId: c.id, usuarioId: 'cron', rol: 'DUENIO', plan: c.plan },
          () => this.reports.generarSiFalta(semana),
        );
        if (r) generados += 1;
      } catch (err) {
        fallidos += 1;
        this.logger.warn({ err, comercioId: c.id }, 'Falló el reporte semanal de un comercio');
      }
    }
    return { comercios: comercios.length, generados, fallidos };
  }
}
