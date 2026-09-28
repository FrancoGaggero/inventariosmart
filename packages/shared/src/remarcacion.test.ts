import { describe, expect, it } from 'vitest';
import {
  calcularItem,
  margenBrutoPct,
  precioPorMargenObjetivo,
  precioPorPorcentaje,
  redondearPrecio,
  RemarcacionApplySchema,
  RemarcacionPreviewSchema,
  resumirRemarcacion,
} from './remarcacion';

const A = { precioActual: '1100', costo: '720', alicuotaIva: '21' };
const base = { redondeo: 'NINGUNO', permitirBajas: false } as const;
const ID = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

describe('redondeo (CP-17.2b)', () => {
  it('siempre hacia arriba, al múltiplo pedido', () => {
    expect(redondearPrecio(1452.3, 'NINGUNO')).toBe('1452.30');
    expect(redondearPrecio(1452.3, 'PESO')).toBe('1453.00');
    expect(redondearPrecio(1452.3, 'DECENA')).toBe('1460.00');
    expect(redondearPrecio(1452.3, 'CENTENA')).toBe('1500.00');
  });

  it('un múltiplo exacto no cambia', () => {
    expect(redondearPrecio(1500, 'CENTENA')).toBe('1500.00');
    expect(redondearPrecio(1500, 'DECENA')).toBe('1500.00');
    expect(redondearPrecio(1500, 'PESO')).toBe('1500.00');
  });

  it('el error de coma flotante no empuja al múltiplo siguiente', () => {
    // 2600 × 1,15 da 2989,9999999999995.
    expect(precioPorPorcentaje(2600, 15)).not.toBe(2990);
    expect(redondearPrecio(precioPorPorcentaje(2600, 15), 'DECENA')).toBe('2990.00');
    expect(redondearPrecio(precioPorPorcentaje(2600, 15), 'PESO')).toBe('2990.00');
    expect(redondearPrecio(1.005, 'NINGUNO')).toBe('1.01');
  });
});

describe('criterios', () => {
  it('CP-17.1 alcanzar la inflación: precio, variación y márgenes', () => {
    expect(calcularItem({ ...A, ...base, precioCalculado: 1200 })).toEqual({
      precioNuevo: '1200.00',
      variacion: '9.09',
      margenBrutoPctActual: '20.80',
      margenBrutoPctNuevo: '27.40',
      resultado: 'SUBE',
    });
  });

  it('CP-17.1b porcentaje fijo con redondeo a la decena', () => {
    const nuevo = (precio: number) =>
      calcularItem({
        ...A,
        precioActual: precio,
        redondeo: 'DECENA',
        permitirBajas: false,
        precioCalculado: precioPorPorcentaje(precio, 15),
      }).precioNuevo;
    expect(nuevo(1100)).toBe('1270.00');
    expect(nuevo(2600)).toBe('2990.00');
    expect(nuevo(1210)).toBe('1400.00');
  });

  it('CP-17.1c margen objetivo', () => {
    expect(precioPorMargenObjetivo('720', 40, '21')).toBeCloseTo(1452, 6);
    const item = calcularItem({
      ...A,
      redondeo: 'CENTENA',
      permitirBajas: false,
      precioCalculado: precioPorMargenObjetivo('720', 40, '21'),
    });
    expect(item).toMatchObject({
      precioNuevo: '1500.00',
      margenBrutoPctNuevo: '41.92',
      resultado: 'SUBE',
    });
    expect(margenBrutoPct('1452', '720', '21')).toBe('40.00');
  });

  it('sin costo cargado no hay margen objetivo', () => {
    expect(precioPorMargenObjetivo('0', 40, '21')).toBeNull();
    expect(margenBrutoPct('500', '0', '21')).toBeNull();
    expect(calcularItem({ ...A, costo: '0', ...base, precioCalculado: null })).toMatchObject({
      precioNuevo: null,
      variacion: null,
      resultado: 'SIN_DATOS',
    });
  });
});

describe('RN-12 protección contra bajas (CP-17.2)', () => {
  const B = { precioActual: '2600', costo: '1500', alicuotaIva: '21', precioCalculado: 2400 };

  it('sin pedirlo, un precio menor queda sin cambio', () => {
    expect(calcularItem({ ...B, ...base })).toMatchObject({
      precioNuevo: '2600.00',
      variacion: '0.00',
      resultado: 'SIN_CAMBIO',
    });
  });

  it('con permitirBajas, baja', () => {
    expect(calcularItem({ ...B, redondeo: 'NINGUNO', permitirBajas: true })).toMatchObject({
      precioNuevo: '2400.00',
      variacion: '-7.69',
      resultado: 'BAJA',
    });
  });

  it('un precio igual al actual es sin cambio', () => {
    expect(
      calcularItem({ ...B, precioCalculado: 2600, redondeo: 'NINGUNO', permitirBajas: true })
        .resultado,
    ).toBe('SIN_CAMBIO');
  });

  it('el resumen cuenta cada resultado', () => {
    expect(
      resumirRemarcacion([
        { resultado: 'SUBE' },
        { resultado: 'SIN_CAMBIO' },
        { resultado: 'SIN_CAMBIO' },
        { resultado: 'SIN_DATOS' },
      ]),
    ).toEqual({ suben: 1, bajan: 0, sinCambio: 2, sinDatos: 1 });
  });
});

describe('esquemas', () => {
  const campos =
    (esquema: typeof RemarcacionPreviewSchema | typeof RemarcacionApplySchema) => (v: unknown) =>
      esquema.safeParse(v).error?.issues.map((i) => i.path.join('.')) ?? [];

  it('la vista previa aplica los valores por defecto', () => {
    expect(RemarcacionPreviewSchema.parse({ criterio: 'INFLACION' })).toEqual({
      criterio: 'INFLACION',
      redondeo: 'NINGUNO',
      permitirBajas: false,
    });
    expect(
      RemarcacionPreviewSchema.parse({
        criterio: 'PORCENTAJE',
        porcentaje: 15,
        redondeo: 'DECENA',
        estado: 'ATRASADO',
      }),
    ).toMatchObject({ porcentaje: 15, redondeo: 'DECENA', estado: 'ATRASADO' });
  });

  it('CP-17.1e parámetros inválidos', () => {
    const e = campos(RemarcacionPreviewSchema);
    expect(e({ criterio: 'PORCENTAJE' })).toEqual(['porcentaje']);
    expect(e({ criterio: 'PORCENTAJE', porcentaje: 501 })).toEqual(['porcentaje']);
    expect(e({ criterio: 'PORCENTAJE', porcentaje: 0 })).toEqual(['porcentaje']);
    expect(e({ criterio: 'MARGEN_OBJETIVO', margen: 100 })).toEqual(['margen']);
    expect(e({ criterio: 'DESCUENTO' })).toEqual(['criterio']);
    expect(e({})).toEqual(['criterio']);
    expect(e({ criterio: 'INFLACION', redondeo: 'MIL' })).toEqual(['redondeo']);
    expect(e({ criterio: 'INFLACION', productoIds: [] })).toEqual(['productoIds']);
  });

  it('CP-17.3c datos inválidos al aplicar', () => {
    const e = campos(RemarcacionApplySchema);
    const item = { productoId: ID(1), precioActual: '1100.00', precioNuevo: '1270.00' };
    expect(e({ criterio: 'PORCENTAJE', items: [item] })).toEqual([]);
    expect(e({ criterio: 'PORCENTAJE', items: [] })).toEqual(['items']);
    expect(e({ criterio: 'PORCENTAJE', items: [item, item] })).toEqual(['items']);
    expect(e({ criterio: 'PORCENTAJE', items: [{ ...item, precioNuevo: '0' }] })).toEqual([
      'items.0.precioNuevo',
    ]);
    expect(e({ criterio: 'PORCENTAJE', items: [{ ...item, precioNuevo: '1100' }] })).toEqual([
      'items.0.precioNuevo',
    ]);
    expect(e({ criterio: 'PORCENTAJE', items: [{ ...item, precioNuevo: '-5' }] })).toEqual([
      'items.0.precioNuevo',
    ]);
    const muchos = Array.from({ length: 5001 }, (_, i) => ({
      ...item,
      productoId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
    }));
    expect(e({ criterio: 'PORCENTAJE', items: muchos })).toEqual(['items']);
  });
});
