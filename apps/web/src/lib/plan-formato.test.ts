import { describe, expect, it } from 'vitest';
import {
  AVISO_SIN_COBRO,
  confirmacionDeCambio,
  esSubida,
  fraseCambio,
  fraseCambioHecho,
  fraseUso,
  tarjetasDePlanes,
  textoBoton,
} from './plan-formato';

describe('tarjetas de los planes (portada y página Plan)', () => {
  it('cada plan muestra lo que suma sobre el anterior', () => {
    expect(tarjetasDePlanes()).toEqual([
      {
        plan: 'FREE',
        nombre: 'Free',
        detalle: 'Para empezar',
        incluye: [
          'Hasta 50 productos',
          '1 usuario',
          'Inventario y movimientos',
          'Panel y rentabilidad',
          'Gastos operativos',
          'Proveedores y listas de precios',
          'Importación desde Excel',
        ],
      },
      {
        plan: 'PRO',
        nombre: 'Pro',
        detalle: 'Para el día a día',
        incluye: [
          'Todo lo de Free',
          'Productos y usuarios sin límite',
          'Alertas de reposición',
          'Pérdidas por falta de stock',
          'Stock parado',
          'Órdenes de compra',
          'Reportes semanales',
          'Precios frente a la inflación',
          'Remarcación asistida',
        ],
      },
      {
        plan: 'PREMIUM',
        nombre: 'Premium',
        detalle: 'Para decidir mejor',
        incluye: ['Todo lo de Pro', 'Comparador de proveedores', 'Asistente con IA'],
      },
    ]);
  });
});

describe('uso contra los límites', () => {
  it('con límite y sin límite', () => {
    expect(fraseUso('productos', 50, 50)).toBe('50 de 50 productos activos');
    expect(fraseUso('usuarios', 1, 1)).toBe('1 de 1 usuario activo');
    expect(fraseUso('productos', 1200, null)).toBe('1.200 productos activos, sin límite');
    expect(fraseUso('usuarios', 1, null)).toBe('1 usuario activo, sin límite');
  });
});

describe('cambio de plan', () => {
  it('distingue subir de bajar', () => {
    expect(esSubida('FREE', 'PRO')).toBe(true);
    expect(esSubida('PRO', 'PREMIUM')).toBe(true);
    expect(esSubida('PREMIUM', 'PRO')).toBe(false);
    expect(esSubida('PRO', 'PRO')).toBe(false);
    expect(textoBoton('PRO', 'PRO')).toBe('Tu plan actual');
    expect(textoBoton('PRO', 'PREMIUM')).toBe('Subir a Premium');
    expect(textoBoton('PRO', 'FREE')).toBe('Bajar a Free');
  });

  it('CP-14.6 al subir dice qué se habilita y que no tiene cobro', () => {
    expect(confirmacionDeCambio('PRO', 'PREMIUM')).toEqual({
      titulo: '¿Pasar al plan Premium?',
      textoConfirmar: 'Subir a Premium',
      baja: false,
      parrafos: ['Se habilita: Comparador de proveedores y Asistente con IA.', AVISO_SIN_COBRO],
    });
  });

  it('al bajar dice qué deja de estar, que los datos se conservan y los límites', () => {
    const c = confirmacionDeCambio('PREMIUM', 'FREE');
    expect(c.baja).toBe(true);
    expect(c.textoConfirmar).toBe('Bajar a Free');
    expect(c.parrafos).toEqual([
      'Deja de estar disponible: Alertas de reposición, Pérdidas por falta de stock, Stock parado, Órdenes de compra, Reportes semanales, Precios frente a la inflación, Remarcación asistida, Comparador de proveedores y Asistente con IA.',
      'No se borra nada: tus datos quedan guardados y vuelven cuando subas de plan.',
      'El plan Free admite hasta 50 productos activos y 1 usuario.',
      AVISO_SIN_COBRO,
    ]);
    // De Premium a Pro no hay límites que avisar.
    expect(confirmacionDeCambio('PREMIUM', 'PRO').parrafos).toEqual([
      'Deja de estar disponible: Comparador de proveedores y Asistente con IA.',
      'No se borra nada: tus datos quedan guardados y vuelven cuando subas de plan.',
      AVISO_SIN_COBRO,
    ]);
  });

  it('textos del historial y del aviso', () => {
    expect(fraseCambio({ planAnterior: 'FREE', planNuevo: 'PRO' })).toBe('De Free a Pro');
    expect(fraseCambioHecho('PREMIUM')).toBe('Listo: tu comercio está en el plan Premium.');
  });
});
