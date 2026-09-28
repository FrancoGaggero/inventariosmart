import { describe, expect, it } from 'vitest';
import {
  armarPedido,
  filasAplicables,
  formatearCambio,
  fraseCriterio,
  fraseDeshecho,
  fraseReversion,
  fraseResumen,
  precioFinal,
  type FormularioRemarcacion,
} from './remarcacion-formato';

const formulario: FormularioRemarcacion = {
  criterio: 'INFLACION',
  porcentaje: '',
  margen: '',
  redondeo: 'NINGUNO',
  permitirBajas: false,
  estado: 'ATRASADO',
  desde: '2026-03',
  hasta: null,
};

const item = (id: string, precioActual: string, precioNuevo: string | null) => ({
  producto: { id, codigo: id, nombre: id },
  precioActual,
  precioNuevo,
  variacion: null,
  costo: '0.00',
  alicuotaIva: '21',
  margenBrutoPctActual: null,
  margenBrutoPctNuevo: null,
  resultado: 'SUBE' as const,
  estado: null,
});

describe('textos de la remarcación', () => {
  it('cuenta cómo se calculó un lote', () => {
    expect(fraseCriterio('PORCENTAJE', { porcentaje: 15, redondeo: 'DECENA' })).toBe(
      'Subió 15 %, redondeado a la decena',
    );
    expect(fraseCriterio('PORCENTAJE', { porcentaje: 7.5, redondeo: 'NINGUNO' })).toBe(
      'Subió 7,5 %',
    );
    expect(fraseCriterio('INFLACION', { redondeo: 'CENTENA' })).toBe(
      'Alcanzó la inflación, redondeado a la centena',
    );
    expect(fraseCriterio('MARGEN_OBJETIVO', { margen: 40 })).toBe('Margen objetivo 40 %');
    expect(fraseCriterio('MARGEN', {})).toBe('Sostuvo el margen');
  });

  it('resume la vista previa', () => {
    expect(fraseResumen({ suben: 12, bajan: 0, sinCambio: 3, sinDatos: 1 })).toBe(
      '12 productos suben, 3 quedan igual y 1 no se puede calcular.',
    );
    expect(fraseResumen({ suben: 1, bajan: 0, sinCambio: 0, sinDatos: 0 })).toBe(
      '1 producto sube.',
    );
    expect(fraseResumen({ suben: 1, bajan: 2, sinCambio: 0, sinDatos: 0 })).toBe(
      '1 producto sube y 2 bajan.',
    );
    expect(fraseResumen({ suben: 0, bajan: 0, sinCambio: 2, sinDatos: 0 })).toBe(
      'Ningún precio cambia: 2 quedan igual.',
    );
    expect(fraseResumen({ suben: 0, bajan: 0, sinCambio: 0, sinDatos: 0 })).toBe(
      'No hay productos para remarcar con este criterio.',
    );
  });

  it('cuenta qué pasó al deshacer', () => {
    expect(fraseReversion(7, [])).toBe('7 productos volvieron a su precio anterior.');
    expect(fraseReversion(1, ['Filtro FC-118'])).toBe(
      '1 producto volvió a su precio anterior. No se tocó 1 producto porque cambió después: Filtro FC-118.',
    );
    expect(fraseReversion(0, ['A', 'B'])).toBe(
      '0 productos volvieron a su precio anterior. No se tocaron 2 productos porque cambiaron después: A, B.',
    );
    expect(fraseDeshecho(1, 1)).toBe('1 revertido y 1 sin tocar');
    expect(fraseDeshecho(5000, 0)).toBe('5000 revertidos');
  });

  it('muestra el cambio con su signo', () => {
    expect(formatearCambio('9.09')).toBe('+9,1 %');
    expect(formatearCambio('-7.69')).toBe('−7,7 %');
    expect(formatearCambio('0.00')).toBe('0 %');
    expect(formatearCambio(null)).toBe('—');
  });
});

describe('pedido de vista previa', () => {
  it('arma el cuerpo según el criterio', () => {
    expect(armarPedido(formulario)).toEqual({
      pedido: {
        criterio: 'INFLACION',
        redondeo: 'NINGUNO',
        permitirBajas: false,
        estado: 'ATRASADO',
        desde: '2026-03',
      },
      error: null,
    });
    expect(
      armarPedido({ ...formulario, criterio: 'PORCENTAJE', porcentaje: '12,5', estado: null })
        .pedido,
    ).toEqual({
      criterio: 'PORCENTAJE',
      porcentaje: 12.5,
      redondeo: 'NINGUNO',
      permitirBajas: false,
      desde: '2026-03',
    });
  });

  it('avisa cuando falta el parámetro del criterio', () => {
    expect(armarPedido({ ...formulario, criterio: 'PORCENTAJE' }).error).toMatch(/porcentaje/);
    expect(armarPedido({ ...formulario, criterio: 'PORCENTAJE', porcentaje: '0' }).pedido).toBe(
      null,
    );
    expect(armarPedido({ ...formulario, criterio: 'PORCENTAJE', porcentaje: 'abc' }).pedido).toBe(
      null,
    );
    expect(armarPedido({ ...formulario, criterio: 'MARGEN_OBJETIVO', margen: '96' }).error).toMatch(
      /margen/,
    );
  });
});

describe('filas que se aplican (CP-17.6)', () => {
  const items = [
    item('a', '1100.00', '1200.00'),
    item('b', '2600.00', '2600.00'),
    item('c', '1210.00', null),
    item('d', '500.00', '600.00'),
  ];

  it('toma el precio calculado y descarta lo que no cambia', () => {
    expect(filasAplicables(items, new Set(), {})).toEqual([
      { productoId: 'a', precioActual: '1100.00', precioNuevo: '1200.00' },
      { productoId: 'd', precioActual: '500.00', precioNuevo: '600.00' },
    ]);
  });

  it('respeta los productos quitados y los precios ajustados a mano', () => {
    expect(filasAplicables(items, new Set(['d']), { a: '1249,90', b: '2700', c: '1300' })).toEqual([
      { productoId: 'a', precioActual: '1100.00', precioNuevo: '1249.90' },
      { productoId: 'b', precioActual: '2600.00', precioNuevo: '2700.00' },
      { productoId: 'c', precioActual: '1210.00', precioNuevo: '1300.00' },
    ]);
  });

  it('un ajuste inválido o igual al actual no se aplica', () => {
    expect(precioFinal(items[0]!, 'mil')).toEqual({
      precio: null,
      error: 'Ingresá un precio mayor a 0, con hasta 2 decimales.',
    });
    expect(precioFinal(items[0]!, '0').precio).toBeNull();
    expect(precioFinal(items[0]!, '1100')).toEqual({ precio: null, error: null });
    expect(precioFinal(items[0]!, '  ')).toEqual({ precio: '1200.00', error: null });
    expect(filasAplicables(items, new Set(), { a: 'mil', d: '500' })).toEqual([]);
  });
});
