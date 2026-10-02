import type { Plan, Rol } from '@inventariosmart/shared';
import { describe, expect, it } from 'vitest';
import { accesosInferiores, nombreAccesible, seccionesDeNavegacion } from './navegacion';

const etiquetas = (rol: Rol, plan: Plan) =>
  seccionesDeNavegacion({ rol, plan }).flatMap((s) => s.items.map((i) => i.etiqueta));

// La visibilidad de antes del rediseño (AppShell), más Falta de stock y Stock parado en PRO.
const ESPERADO: Record<Rol, Record<'FREE' | 'PRO', string[]>> = {
  DUENIO: {
    FREE: [
      'Inicio',
      'Movimientos',
      'Inventario',
      'Rentabilidad',
      'Gastos',
      'Alertas',
      'Proveedores',
      'Asistente',
      'Usuarios',
      'Comercio',
      'Plan',
    ],
    PRO: [
      'Inicio',
      'Movimientos',
      'Inventario',
      'Rentabilidad',
      'Gastos',
      'Alertas',
      'Falta de stock',
      'Stock parado',
      'Inflación',
      'Reportes',
      'Órdenes',
      'Proveedores',
      'Remarcaciones',
      'Asistente',
      'Usuarios',
      'Comercio',
      'Plan',
    ],
  },
  CONTADOR: {
    FREE: ['Inicio', 'Movimientos', 'Rentabilidad', 'Gastos', 'Alertas', 'Plan'],
    PRO: [
      'Inicio',
      'Movimientos',
      'Rentabilidad',
      'Gastos',
      'Alertas',
      'Falta de stock',
      'Stock parado',
      'Inflación',
      'Reportes',
      'Órdenes',
      'Remarcaciones',
      'Plan',
    ],
  },
  EMPLEADO: {
    FREE: ['Inicio', 'Movimientos', 'Inventario', 'Plan'],
    PRO: ['Inicio', 'Movimientos', 'Inventario', 'Plan'],
  },
};

const ROLES: Rol[] = ['DUENIO', 'CONTADOR', 'EMPLEADO'];
const PLANES: Plan[] = ['FREE', 'PRO', 'PREMIUM'];

describe('navegación (web-redesign D3)', () => {
  it.each(ROLES.flatMap((rol) => PLANES.map((plan) => [rol, plan] as const)))(
    '%s en %s ve lo mismo que antes, más los análisis de stock en PRO',
    (rol, plan) => {
      expect(etiquetas(rol, plan)).toEqual(ESPERADO[rol][plan === 'FREE' ? 'FREE' : 'PRO']);
    },
  );

  it('agrupa por secciones y no devuelve grupos vacíos', () => {
    expect(seccionesDeNavegacion({ rol: 'DUENIO', plan: 'PREMIUM' }).map((s) => s.titulo)).toEqual([
      'General',
      'Análisis',
      'Compras',
      'Asistente',
      'Cuenta',
    ]);
    expect(seccionesDeNavegacion({ rol: 'EMPLEADO', plan: 'PRO' }).map((s) => s.clave)).toEqual([
      'general',
      'cuenta',
    ]);
    for (const rol of ROLES) {
      for (const plan of PLANES) {
        for (const s of seccionesDeNavegacion({ rol, plan }))
          expect(s.items.length).toBeGreaterThan(0);
      }
    }
  });

  it('la barra inferior tiene cuatro accesos por rol, todos visibles en el menú', () => {
    expect(accesosInferiores({ rol: 'DUENIO', plan: 'PRO' }).map((i) => i.etiqueta)).toEqual([
      'Inicio',
      'Movimientos',
      'Inventario',
      'Alertas',
    ]);
    expect(accesosInferiores({ rol: 'CONTADOR', plan: 'FREE' }).map((i) => i.etiqueta)).toEqual([
      'Inicio',
      'Rentabilidad',
      'Alertas',
      'Gastos',
    ]);
    expect(accesosInferiores({ rol: 'EMPLEADO', plan: 'FREE' }).map((i) => i.etiqueta)).toEqual([
      'Inicio',
      'Inventario',
      'Movimientos',
      'Plan',
    ]);
    for (const rol of ROLES) {
      for (const plan of PLANES) {
        const visibles = new Set(etiquetas(rol, plan));
        const accesos = accesosInferiores({ rol, plan });
        expect(accesos).toHaveLength(4);
        for (const a of accesos) expect(visibles.has(a.etiqueta)).toBe(true);
      }
    }
  });

  it('Inicio sólo se marca en la ruta exacta y Alertas lleva el conteo', () => {
    const items = seccionesDeNavegacion({ rol: 'DUENIO', plan: 'PRO' }).flatMap((s) => s.items);
    expect(items.find((i) => i.etiqueta === 'Inicio')).toMatchObject({ to: '/', fin: true });
    const alertas = items.find((i) => i.etiqueta === 'Alertas')!;
    expect(nombreAccesible(alertas, 3)).toBe('Alertas, 3 activas');
    expect(nombreAccesible(alertas, 1)).toBe('Alertas, 1 activa');
    expect(nombreAccesible(alertas, 0)).toBe('Alertas');
    expect(nombreAccesible(items[0]!, 5)).toBe('Inicio');
  });
});
