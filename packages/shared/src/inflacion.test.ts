import { describe, expect, it } from 'vitest';
import {
  cierreDeMes,
  compararProducto,
  estadoPrecio,
  indiceBase100,
  InflacionQuerySchema,
  inicioDeMes,
  listaMeses,
  mesDe,
  ordenarPorAtraso,
  precioSugeridoInflacion,
  precioSugeridoMargen,
  valorCanasta,
  variacionReal,
  variacionSerie,
  type FilaProductoInflacion,
} from './inflacion';

const ref = (codigo: string) => ({
  id: '00000000-0000-4000-8000-000000000000',
  codigo,
  nombre: `Producto ${codigo}`,
});

// CP-15.3: A con 30 unidades y B con 10, entre enero y junio; el IPC pasa de 100 a 120.
const A: FilaProductoInflacion = {
  producto: ref('A'),
  unidades: 30,
  precioInicial: '1000',
  precioFinal: '1100',
  costoInicial: '600',
  costoFinal: '720',
  datosDesde: '2026-01-05T12:00:00.000Z',
};
const B: FilaProductoInflacion = {
  producto: ref('B'),
  unidades: 10,
  precioInicial: '2000',
  precioFinal: '2600',
  costoInicial: '1200',
  costoFinal: '1500',
  datosDesde: '2026-01-05T12:00:00.000Z',
};

describe('RN-11 variación real', () => {
  it('descuenta la inflación de la variación nominal', () => {
    expect(variacionReal('18.00', '20.00')).toBe('-1.67');
    expect(variacionReal('18.00', '22.00')).toBe('-3.28');
    expect(variacionReal('10.00', '20.00')).toBe('-8.33');
    expect(variacionReal('30.00', '20.00')).toBe('8.33');
    expect(variacionReal('21.00', '20.00')).toBe('0.83');
  });

  it('sin alguno de los dos datos no hay variación real', () => {
    expect(variacionReal(null, '20.00')).toBeNull();
    expect(variacionReal('10.00', null)).toBeNull();
    expect(variacionReal('10.00', '-100')).toBeNull();
  });
});

describe('estado del precio', () => {
  it('atrasado, alineado y adelantado', () => {
    expect(estadoPrecio('-8.33')).toBe('ATRASADO');
    expect(estadoPrecio('0.83')).toBe('ALINEADO');
    expect(estadoPrecio('8.33')).toBe('ADELANTADO');
    expect(estadoPrecio(null)).toBeNull();
  });

  it('el borde de ±2 % cuenta como alineado', () => {
    expect(estadoPrecio('-2.00')).toBe('ALINEADO');
    expect(estadoPrecio('2.00')).toBe('ALINEADO');
    expect(estadoPrecio('-2.01')).toBe('ATRASADO');
    expect(estadoPrecio('2.01')).toBe('ADELANTADO');
  });
});

describe('índices base 100 de la canasta fija (CP-15.3)', () => {
  const canasta = [A, B];

  it('mis precios terminan en 118 y mis costos en 122', () => {
    const precios = [
      valorCanasta(canasta, (f) => f.precioInicial),
      valorCanasta(canasta, (f) => f.precioFinal),
    ];
    const costos = [
      valorCanasta(canasta, (f) => f.costoInicial),
      valorCanasta(canasta, (f) => f.costoFinal),
    ];
    expect(precios).toEqual([50000, 59000]);
    expect(costos).toEqual([30000, 36600]);
    expect(indiceBase100(precios)).toEqual(['100.00', '118.00']);
    expect(indiceBase100(costos)).toEqual(['100.00', '122.00']);
    expect(variacionSerie(indiceBase100(precios))).toBe('18.00');
    expect(variacionSerie(indiceBase100(costos))).toBe('22.00');
  });

  it('el IPC se lleva a base 100 desde su nivel', () => {
    expect(indiceBase100([10000, 10400, 12000])).toEqual(['100.00', '104.00', '120.00']);
  });

  it('los meses sin dato quedan nulos y la base es el primer valor positivo', () => {
    expect(indiceBase100([null, 200, null, 250])).toEqual([null, '100.00', null, '125.00']);
    expect(indiceBase100([0, 200, 300])).toEqual([null, '100.00', '150.00']);
    expect(indiceBase100([null, null])).toEqual([null, null]);
    expect(indiceBase100([])).toEqual([]);
  });

  it('una serie con menos de dos puntos no tiene variación', () => {
    expect(variacionSerie(['100.00'])).toBeNull();
    expect(variacionSerie([null, null])).toBeNull();
    expect(variacionSerie([null, '100.00', null, '125.00'])).toBe('25.00');
  });
});

describe('precios sugeridos', () => {
  it('para alcanzar la inflación', () => {
    expect(precioSugeridoInflacion('1000', '20.00')).toBe('1200.00');
    expect(precioSugeridoInflacion('2000', '20.00')).toBe('2400.00');
    expect(precioSugeridoInflacion('1000', null)).toBeNull();
  });

  it('para sostener el margen del inicio con el costo final', () => {
    expect(precioSugeridoMargen('1000', '600', '720')).toBe('1200.00');
    expect(precioSugeridoMargen('2000', '1200', '1500')).toBe('2500.00');
  });

  it('sin costo inicial devuelve el precio inicial', () => {
    expect(precioSugeridoMargen('1000', '0', '500')).toBe('1000.00');
  });
});

describe('comparación por producto (CP-15.4)', () => {
  it('A está atrasado y B adelantado', () => {
    expect(compararProducto(A, '20.00')).toMatchObject({
      unidadesVendidas: 30,
      precioInicial: '1000.00',
      precioFinal: '1100.00',
      variacionPrecio: '10.00',
      variacionCosto: '20.00',
      variacionReal: '-8.33',
      estado: 'ATRASADO',
      precioSugeridoInflacion: '1200.00',
      precioSugeridoMargen: '1200.00',
    });
    expect(compararProducto(B, '20.00')).toMatchObject({
      variacionPrecio: '30.00',
      variacionCosto: '25.00',
      variacionReal: '8.33',
      estado: 'ADELANTADO',
      precioSugeridoInflacion: '2400.00',
      precioSugeridoMargen: '2500.00',
    });
  });

  it('CP-15.4b alineado y con costo constante', () => {
    const c = compararProducto(
      { ...A, producto: ref('C'), precioFinal: '1210', costoInicial: '0', costoFinal: '0' },
      '20.00',
    );
    expect(c).toMatchObject({
      variacionReal: '0.83',
      estado: 'ALINEADO',
      variacionCosto: '0.00',
      precioSugeridoMargen: '1000.00',
    });
  });

  it('sin IPC no hay estado ni precio sugerido por inflación', () => {
    expect(compararProducto(A, null)).toMatchObject({
      variacionPrecio: '10.00',
      variacionReal: null,
      estado: null,
      precioSugeridoInflacion: null,
    });
  });

  it('ordena del más atrasado al más adelantado', () => {
    const lista = ordenarPorAtraso([
      compararProducto(B, '20.00'),
      compararProducto({ ...A, producto: ref('S') }, null),
      compararProducto(A, '20.00'),
    ]);
    expect(lista.map((p) => p.producto.codigo)).toEqual(['A', 'B', 'S']);
  });
});

describe('meses en Buenos Aires', () => {
  it('lista los meses del período, ambos inclusive', () => {
    expect(listaMeses('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(listaMeses('2026-06', '2026-06')).toEqual(['2026-06']);
    expect(listaMeses('2026-06', '2026-05')).toEqual([]);
  });

  it('un mes empieza y cierra a las 00:00 de Buenos Aires', () => {
    expect(inicioDeMes('2026-01').toISOString()).toBe('2026-01-01T03:00:00.000Z');
    expect(cierreDeMes('2026-12').toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it('el mes de un instante se toma en Buenos Aires', () => {
    expect(mesDe(new Date('2026-09-01T02:59:59Z'))).toBe('2026-08');
    expect(mesDe(new Date('2026-09-01T03:00:00Z'))).toBe('2026-09');
  });
});

describe('InflacionQuerySchema', () => {
  const errores = (v: unknown) =>
    InflacionQuerySchema.safeParse(v).error?.issues.map((i) => i.path.join('.')) ?? [];

  it('acepta el período vacío, parcial o completo', () => {
    expect(InflacionQuerySchema.safeParse({}).success).toBe(true);
    expect(InflacionQuerySchema.safeParse({ desde: '2026-01' }).success).toBe(true);
    expect(InflacionQuerySchema.safeParse({ desde: '2026-01', hasta: '2026-06' }).success).toBe(
      true,
    );
    expect(InflacionQuerySchema.safeParse({ desde: '2024-09', hasta: '2026-08' }).success).toBe(
      true,
    );
  });

  it('rechaza el formato inválido, el orden invertido y más de 24 meses', () => {
    expect(errores({ desde: '2026-13' })).toEqual(['desde']);
    expect(errores({ hasta: '06/2026' })).toEqual(['hasta']);
    expect(errores({ desde: '2026-07', hasta: '2026-06' })).toEqual(['desde']);
    expect(errores({ desde: '2024-08', hasta: '2026-08' })).toEqual(['hasta']);
  });
});
