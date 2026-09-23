import type { ConfigService } from '@nestjs/config';
import { TenantContext } from '../auth/tenant-context';
import type { PrismaService } from '../prisma/prisma.service';
import { AlertsCron } from './alerts.cron';
import type { AlertsService } from './alerts.service';

describe('AlertsCron (design D4)', () => {
  const comercios = [
    { id: 'c-pro', plan: 'PRO' as const },
    { id: 'c-premium', plan: 'PREMIUM' as const },
  ];
  const prisma = {
    comoSistema: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) =>
      fn({
        comercio: {
          findMany: jest.fn(async (args: { where: { plan: { in: string[] } } }) => {
            expect(args.where.plan.in).toEqual(['PRO', 'PREMIUM']);
            return comercios;
          }),
        },
      }),
    ),
  } as unknown as PrismaService;
  const contextos: string[] = [];
  const alerts = {
    recalcular: jest.fn(async () => {
      const ctx = TenantContext.requerido();
      contextos.push(`${ctx.comercioId}:${ctx.plan}`);
      if (ctx.comercioId === 'c-premium') throw new Error('falla simulada');
      return { creadas: 2, actualizadas: 0, resueltas: 0, calculadasEn: new Date().toISOString() };
    }),
  } as unknown as AlertsService;
  const config = (env: string) =>
    ({ get: jest.fn(() => env) }) as unknown as ConfigService<Record<string, string>, true>;

  it('recorre sólo comercios PRO/PREMIUM con el contexto de cada uno y tolera fallos', async () => {
    const cron = new AlertsCron(prisma, alerts, config('production') as never);
    const r = await cron.correr();
    expect(contextos).toEqual(['c-pro:PRO', 'c-premium:PREMIUM']);
    expect(r).toEqual({ comercios: 2, creadas: 2, fallidos: 1 });
  });

  it('en tests el job diario no corre', async () => {
    const cron = new AlertsCron(prisma, alerts, config('test') as never);
    (alerts.recalcular as jest.Mock).mockClear();
    await cron.diario();
    expect(alerts.recalcular).not.toHaveBeenCalled();
  });
});
