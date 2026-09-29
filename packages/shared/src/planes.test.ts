import { describe, expect, it } from 'vitest';
import {
  CambioPlanSchema,
  FUNCIONALIDADES,
  PLANES,
  diferenciaDePlanes,
  evaluarCambioDePlan,
  excesosDe,
  funcionalidadesDe,
  funcionalidadesPropias,
  planCumple,
} from './planes';

const claves = (lista: readonly { clave: string }[]) => lista.map((f) => f.clave);

describe('catálogo de funcionalidades (design D1)', () => {
  it('tiene claves únicas y un plan mínimo válido en cada una', () => {
    expect(new Set(claves(FUNCIONALIDADES)).size).toBe(FUNCIONALIDADES.length);
    for (const f of FUNCIONALIDADES) {
      expect(PLANES).toContain(f.planMinimo);
      expect(f.nombre.length).toBeGreaterThan(3);
      expect(f.descripcion.length).toBeGreaterThan(10);
    }
  });

  it('cada plan suma funcionalidades sobre el anterior', () => {
    expect(claves(funcionalidadesPropias('FREE'))).toEqual([
      'inventario',
      'panel',
      'gastos',
      'proveedores',
      'importacion',
    ]);
    expect(claves(funcionalidadesPropias('PRO'))).toEqual([
      'alertas',
      'ordenes',
      'reportes',
      'inflacion',
      'remarcacion',
    ]);
    expect(claves(funcionalidadesPropias('PREMIUM'))).toEqual(['comparador', 'asistente']);
  });

  it('CP-14.2 visto desde PRO, sólo lo de PREMIUM queda sin incluir', () => {
    const noIncluidas = funcionalidadesDe('PRO').filter((f) => !f.incluida);
    expect(noIncluidas.map((f) => [f.clave, f.planMinimo])).toEqual([
      ['comparador', 'PREMIUM'],
      ['asistente', 'PREMIUM'],
    ]);
    expect(funcionalidadesDe('PREMIUM').every((f) => f.incluida)).toBe(true);
    expect(claves(funcionalidadesDe('FREE').filter((f) => f.incluida))).toEqual(
      claves(funcionalidadesPropias('FREE')),
    );
  });

  it('planCumple respeta el orden FREE < PRO < PREMIUM', () => {
    expect(planCumple('PRO', 'PRO')).toBe(true);
    expect(planCumple('PREMIUM', 'PRO')).toBe(true);
    expect(planCumple('FREE', 'PRO')).toBe(false);
    expect(planCumple('PRO', 'PREMIUM')).toBe(false);
  });
});

describe('diferencia entre planes', () => {
  it('al subir dice qué se habilita', () => {
    const d = diferenciaDePlanes('FREE', 'PRO');
    expect(claves(d.seHabilitan)).toEqual(claves(funcionalidadesPropias('PRO')));
    expect(d.dejanDeEstar).toEqual([]);
    expect(claves(diferenciaDePlanes('PRO', 'PREMIUM').seHabilitan)).toEqual([
      'comparador',
      'asistente',
    ]);
  });

  it('al bajar dice qué deja de estar disponible', () => {
    const d = diferenciaDePlanes('PREMIUM', 'FREE');
    expect(d.seHabilitan).toEqual([]);
    expect(claves(d.dejanDeEstar)).toEqual([
      ...claves(funcionalidadesPropias('PRO')),
      ...claves(funcionalidadesPropias('PREMIUM')),
    ]);
    expect(claves(diferenciaDePlanes('PREMIUM', 'PRO').dejanDeEstar)).toEqual([
      'comparador',
      'asistente',
    ]);
  });
});

describe('regla de cambio de plan (design D2)', () => {
  const chico = { productos: 10, usuarios: 1 };

  it('CP-14.5 subir siempre se puede', () => {
    expect(evaluarCambioDePlan('FREE', 'PRO', chico)).toEqual({ permitido: true });
    expect(evaluarCambioDePlan('FREE', 'PREMIUM', { productos: 50, usuarios: 1 })).toEqual({
      permitido: true,
    });
    expect(evaluarCambioDePlan('PRO', 'PREMIUM', { productos: 9000, usuarios: 40 })).toEqual({
      permitido: true,
    });
  });

  it('CP-14.5b bajar se puede si el uso entra en el plan nuevo', () => {
    expect(evaluarCambioDePlan('PREMIUM', 'FREE', chico)).toEqual({ permitido: true });
    expect(evaluarCambioDePlan('PRO', 'FREE', { productos: 50, usuarios: 1 })).toEqual({
      permitido: true,
    });
    // De PREMIUM a PRO no hay límites que cumplir.
    expect(evaluarCambioDePlan('PREMIUM', 'PRO', { productos: 9000, usuarios: 40 })).toEqual({
      permitido: true,
    });
  });

  it('CP-14.5c bajar a FREE por encima de los límites informa cuánto sobra', () => {
    expect(evaluarCambioDePlan('PRO', 'FREE', { productos: 60, usuarios: 3 })).toEqual({
      permitido: false,
      motivo: 'SUPERA_LIMITES',
      excesos: [
        { recurso: 'productos', cantidad: 60, limite: 50 },
        { recurso: 'usuarios', cantidad: 3, limite: 1 },
      ],
    });
    expect(evaluarCambioDePlan('PRO', 'FREE', { productos: 51, usuarios: 1 })).toMatchObject({
      motivo: 'SUPERA_LIMITES',
      excesos: [{ recurso: 'productos', cantidad: 51, limite: 50 }],
    });
    expect(evaluarCambioDePlan('PREMIUM', 'FREE', { productos: 3, usuarios: 2 })).toMatchObject({
      motivo: 'SUPERA_LIMITES',
      excesos: [{ recurso: 'usuarios', cantidad: 2, limite: 1 }],
    });
  });

  it('CP-14.5d pedir el plan vigente se rechaza', () => {
    expect(evaluarCambioDePlan('PRO', 'PRO', chico)).toEqual({
      permitido: false,
      motivo: 'MISMO_PLAN',
      excesos: [],
    });
  });

  it('excesosDe sin límites no informa nada', () => {
    expect(excesosDe('PRO', { productos: 100000, usuarios: 500 })).toEqual([]);
    expect(excesosDe('FREE', { productos: 50, usuarios: 1 })).toEqual([]);
  });
});

describe('pedido de cambio', () => {
  it('sólo acepta los tres planes', () => {
    expect(CambioPlanSchema.parse({ plan: 'PRO' })).toEqual({ plan: 'PRO' });
    for (const plan of ['GOLD', 'pro', '', null, undefined]) {
      const r = CambioPlanSchema.safeParse({ plan });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(['plan']);
    }
  });
});

describe('mensaje de un cambio rechazado', () => {
  it('dice cuánto sobra de cada recurso', async () => {
    const { mensajeCambioRechazado } = await import('./planes');
    const evaluacion = evaluarCambioDePlan('PRO', 'FREE', { productos: 60, usuarios: 3 });
    if (evaluacion.permitido) throw new Error('Se esperaba un rechazo');
    expect(mensajeCambioRechazado('FREE', evaluacion)).toBe(
      'No se puede pasar al plan Free: tenés 60 productos activos y el plan admite 50; tenés 3 usuarios activos y el plan admite 1. Dá de baja lo que sobra y volvé a intentar.',
    );
    const mismo = evaluarCambioDePlan('PREMIUM', 'PREMIUM', { productos: 1, usuarios: 1 });
    if (mismo.permitido) throw new Error('Se esperaba un rechazo');
    expect(mensajeCambioRechazado('PREMIUM', mismo)).toBe(
      'Tu comercio ya está en el plan Premium.',
    );
  });
});
