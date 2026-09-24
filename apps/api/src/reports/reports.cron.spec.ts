import type { ConfigService } from '@nestjs/config';
import { TenantContext } from '../auth/tenant-context';
import type { PrismaService } from '../prisma/prisma.service';
import { ReportsCron } from './reports.cron';
import type { ReportsService } from './reports.service';

describe('ReportsCron (design D4)', () => {
  const comercios = [
    { id: 'c-pro', plan: 'PRO' as const },
    { id: 'c-premium', plan: 'PREMIUM' as const },
  ];
  const prisma = {
    comoSistema: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        comercio: {
          findMany: jest.fn(
            async (args: { where: { plan: { in: string[] }; reportesActivos: boolean } }) => {
              // Sólo PRO/PREMIUM con reportes activos: FREE e inactivos quedan afuera en la consulta.
              expect(args.where.plan.in).toEqual(['PRO', 'PREMIUM']);
              expect(args.where.reportesActivos).toBe(true);
              return comercios;
            },
          ),
        },
      }),
    ),
  } as unknown as PrismaService;
  const contextos: string[] = [];
  const reports = {
    generarSiFalta: jest.fn(async (semana: string) => {
      const ctx = TenantContext.requerido();
      contextos.push(`${ctx.comercioId}:${ctx.plan}:${semana}`);
      if (ctx.comercioId === 'c-premium') throw new Error('falla simulada');
      return { id: 'r1' };
    }),
  } as unknown as ReportsService;
  const config = (env: string) =>
    ({ get: jest.fn(() => env) }) as unknown as ConfigService<Record<string, string>, true>;

  it('recorre los comercios PRO/PREMIUM activos con su contexto y tolera fallos', async () => {
    const cron = new ReportsCron(prisma, reports, config('production') as never);
    const r = await cron.correr('2026-W38');
    expect(contextos).toEqual(['c-pro:PRO:2026-W38', 'c-premium:PREMIUM:2026-W38']);
    expect(r).toEqual({ comercios: 2, generados: 1, fallidos: 1 });
  });

  it('en tests el job semanal no corre', async () => {
    const cron = new ReportsCron(prisma, reports, config('test') as never);
    (reports.generarSiFalta as jest.Mock).mockClear();
    await cron.semanal();
    expect(reports.generarSiFalta).not.toHaveBeenCalled();
  });
});
