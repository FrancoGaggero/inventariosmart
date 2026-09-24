import type { ContenidoReporte } from '@inventariosmart/shared';
import { armarSemanal, etiquetaSemana } from './semanal';

const producto = {
  id: '6f1e2d3c-4b5a-4c6d-8e7f-90a1b2c3d4e5',
  codigo: 'FA-220',
  nombre: 'Filtro <Aire>',
};

const contenido: ContenidoReporte = {
  semana: '2026-W38',
  desde: '2026-09-14T03:00:00.000Z',
  hasta: '2026-09-21T03:00:00.000Z',
  mesGastos: '2026-09',
  resumen: {
    unidadesVendidas: 40,
    ventasNetas: '113223.10',
    costoVendido: '72000.00',
    margenBruto: '41223.10',
    margenBrutoPct: '36.41',
    gastoPorUnidad: '2500.00',
    gastos: '100000.00',
    margenNeto: '-58776.90',
    margenNetoPct: '-51.91',
    motivo: null,
  },
  semanaAnterior: {
    semana: '2026-W37',
    ventasNetas: '100000.00',
    unidadesVendidas: 35,
    variacionVentasPct: '13.22',
  },
  estrellas: [
    {
      producto,
      unidadesVendidas: 30,
      margenBruto: '1123.14',
      margenBrutoPct: '34.85',
      margenBrutoSemana: '33694.20',
    },
  ],
  oportunidades: {
    comprarMasBarato: {
      items: [
        {
          producto,
          proveedorActual: 'Norte',
          proveedorSugerido: 'Sur',
          proveedorSugeridoId: '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d',
          costoActual: '2340.00',
          costoSugerido: '2000.00',
          unidades30d: 60,
          ahorroEstimado: '20400.00',
        },
      ],
      total: '20400.00',
    },
    capitalInmovilizado: { items: [], total: '0.00' },
    margenBajo: { items: [], total: '0.00' },
  },
  alertasCriticas: [{ producto, stock: 3, diasCobertura: 1, cantidadSugerida: 64 }],
  generadoEn: '2026-09-21T11:00:00.000Z',
};

describe('plantilla del reporte semanal (HU-09, design D5)', () => {
  it('asunto con el rango, números, estrellas, oportunidades, alertas y enlace', () => {
    const c = armarSemanal(
      'Repuestos Carlos',
      contenido,
      'https://inventariosmart0.vercel.app/',
      'rep-1',
    );
    expect(c.asunto).toBe('Tu semana en Repuestos Carlos · 14 sept al 20 sept');
    expect(c.html).toContain('$ 113.223,10');
    expect(c.html).toContain('▲ 13,22 % más que la semana anterior');
    expect(c.html).toContain('Filtro &lt;Aire&gt;');
    expect(c.html).toContain('$ 33.694,20');
    expect(c.html).toContain('Comprar más barato');
    expect(c.html).toContain('ahorro <b>$ 20.400,00</b>');
    expect(c.html).toContain('Reposición urgente');
    expect(c.html).toContain('href="https://inventariosmart0.vercel.app/reportes/rep-1"');
    expect(c.texto).toContain('Margen neto: $ -58.776,90 (-51,91 %)');
    expect(c.texto).toContain('- Filtro <Aire>: 30 vendidas, 34,85 % de margen, $ 33.694,20');
    expect(c.texto).toContain('Ver el reporte: https://inventariosmart0.vercel.app/reportes/rep-1');
  });

  it('sin ventas ni oportunidades lo dice en lenguaje claro', () => {
    const vacio: ContenidoReporte = {
      ...contenido,
      resumen: {
        ...contenido.resumen,
        unidadesVendidas: 0,
        margenNeto: null,
        margenNetoPct: null,
        motivo: 'SIN_VENTAS',
      },
      semanaAnterior: { ...contenido.semanaAnterior, variacionVentasPct: null },
      estrellas: [],
      oportunidades: {
        comprarMasBarato: { items: [], total: '0.00' },
        capitalInmovilizado: { items: [], total: '0.00' },
        margenBajo: { items: [], total: '0.00' },
      },
      alertasCriticas: [],
    };
    const c = armarSemanal('Kiosco', vacio, 'https://x.test', 'rep-2');
    expect(c.html).toContain('Sin ventas esta semana.');
    expect(c.html).toContain('Sin oportunidades esta semana');
    expect(c.html).toContain('sin semana anterior para comparar');
    expect(c.html).not.toContain('Reposición urgente');
    expect(c.texto).toContain('Margen neto: no calculable');
    expect(etiquetaSemana('2026-W40')).toBe('28 sept al 4 oct');
  });
});
