import { ErrorFuente, FuenteBcra, FuenteFalsa, FuenteIndec } from './fuentes';

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

describe('fuentes de indicadores (design D3)', () => {
  const desde = new Date('2026-05-15T12:00:00Z');
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch');
  });
  afterEach(() => {
    fetchMock.mockRestore();
  });

  describe('INDEC', () => {
    const fuente = new FuenteIndec('https://indec.test/api');

    it('lee el IPC general y el de bienes en una sola llamada', async () => {
      fetchMock.mockResolvedValue(
        json({
          data: [
            ['2026-07-01', 12076.3937, 11856.4137],
            ['2026-08-01', 12276.766, null],
          ],
          count: 2,
        }),
      );
      await expect(fuente.leer(desde)).resolves.toEqual([
        { serie: 'IPC_GENERAL', fecha: '2026-07-01', valor: 12076.3937 },
        { serie: 'IPC_BIENES', fecha: '2026-07-01', valor: 11856.4137 },
        { serie: 'IPC_GENERAL', fecha: '2026-08-01', valor: 12276.766 },
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const url = String(fetchMock.mock.calls[0]![0]);
      expect(url).toContain('https://indec.test/api/series/?ids=148.3_INIVELNAL_DICI_M_26,');
      expect(url).toContain('start_date=2026-05-01');
    });

    it('una respuesta con otra forma se informa como error de la fuente', async () => {
      fetchMock.mockResolvedValue(json({ series: [] }));
      await expect(fuente.leer(desde)).rejects.toThrow(
        'INDEC: la respuesta no tiene la forma esperada',
      );
    });

    it('si no responde a tiempo, falla sin colgarse', async () => {
      fetchMock.mockRejectedValue(new DOMException('timeout', 'TimeoutError'));
      await expect(fuente.leer(desde)).rejects.toThrow('INDEC: no respondió a tiempo');
    });

    it('pasa una señal de corte a la consulta', async () => {
      fetchMock.mockResolvedValue(json({ data: [] }));
      await fuente.leer(desde);
      expect(fetchMock.mock.calls[0]![1]?.signal).toBeInstanceOf(AbortSignal);
    });
  });

  describe('BCRA', () => {
    const fuente = new FuenteBcra('https://bcra.test/v4.0');
    const detalle = (idVariable: number, filas: [string, number][]) =>
      json({
        status: 200,
        results: [{ idVariable, detalle: filas.map(([fecha, valor]) => ({ fecha, valor })) }],
      });

    it('lee inflación mensual, interanual y dólar minorista', async () => {
      fetchMock.mockImplementation(async (url) => {
        const u = String(url);
        if (u.includes('/monetarias/27?')) return detalle(27, [['2026-08-31', 1.7]]);
        if (u.includes('/monetarias/28?')) return detalle(28, [['2026-08-31', 33.5]]);
        return detalle(4, [
          ['2026-09-25', 1545.12],
          ['2026-09-24', 1538.39],
        ]);
      });
      const lecturas = await fuente.leer(desde);
      expect(lecturas).toEqual([
        { serie: 'INFLACION_MENSUAL', fecha: '2026-08-31', valor: 1.7 },
        { serie: 'INFLACION_INTERANUAL', fecha: '2026-08-31', valor: 33.5 },
        { serie: 'USD_MINORISTA', fecha: '2026-09-25', valor: 1545.12 },
        { serie: 'USD_MINORISTA', fecha: '2026-09-24', valor: 1538.39 },
      ]);
      expect(fetchMock).toHaveBeenCalledTimes(3);
      expect(String(fetchMock.mock.calls[0]![0])).toContain('desde=2026-05-15');
    });

    it('una versión retirada (410) se informa como error de la fuente', async () => {
      fetchMock.mockImplementation(async () =>
        json({ status: 410, errorMessages: ['Deprecada'] }, 410),
      );
      const error = await fuente.leer(desde).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(ErrorFuente);
      expect((error as ErrorFuente).message).toBe('BCRA: respondió 410');
    });

    it('una respuesta con otra forma se informa como error de la fuente', async () => {
      fetchMock.mockImplementation(async () =>
        json({ results: [{ idVariable: 27, detalle: [{ d: 1 }] }] }),
      );
      await expect(fuente.leer(desde)).rejects.toThrow(
        'BCRA: la respuesta no tiene la forma esperada',
      );
    });

    it('una caída de red se informa como error de la fuente', async () => {
      fetchMock.mockRejectedValue(new TypeError('fetch failed'));
      await expect(fuente.leer(desde)).rejects.toThrow('BCRA: no se pudo conectar');
    });
  });

  describe('doble para tests', () => {
    it('cuenta las llamadas y simula la caída', async () => {
      const fuente = new FuenteFalsa();
      fuente.lecturas = [
        { serie: 'IPC_GENERAL', fecha: '2026-04-01', valor: 1 },
        { serie: 'IPC_GENERAL', fecha: '2026-06-01', valor: 2 },
      ];
      await expect(fuente.leer(desde)).resolves.toEqual([
        { serie: 'IPC_GENERAL', fecha: '2026-06-01', valor: 2 },
      ]);
      fuente.fallar = true;
      await expect(fuente.leer(desde)).rejects.toBeInstanceOf(ErrorFuente);
      expect(fuente.llamadas).toBe(2);
    });
  });
});
