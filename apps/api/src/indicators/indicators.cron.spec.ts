import type { ConfigService } from '@nestjs/config';
import { IndicatorsCron } from './indicators.cron';
import type { IndicatorsService } from './indicators.service';

describe('IndicatorsCron (design D4)', () => {
  const indicators = { actualizar: jest.fn(async () => undefined) };
  const config = (env: string) =>
    ({ get: jest.fn(() => env) }) as unknown as ConfigService<Record<string, string>, true>;
  const cron = (env: string) =>
    new IndicatorsCron(indicators as unknown as IndicatorsService, config(env) as never);

  beforeEach(() => indicators.actualizar.mockClear());

  it('el job diario consulta las fuentes aunque el dato no haya vencido', async () => {
    await cron('production').diario();
    expect(indicators.actualizar).toHaveBeenCalledWith(true);
  });

  it('en tests el job diario no corre', async () => {
    await cron('test').diario();
    expect(indicators.actualizar).not.toHaveBeenCalled();
  });
});
