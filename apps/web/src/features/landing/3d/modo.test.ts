import { describe, expect, it } from 'vitest';
import { decidirModo, type Entorno } from './modo';

const compu: Entorno = {
  movimientoReducido: false,
  webgl: true,
  punteroFino: true,
  ancho: 1440,
  ahorroDeDatos: false,
  memoria: 8,
  nucleos: 8,
  degradado: false,
};

describe('decidirModo (landing-3d D2)', () => {
  it('compu con mouse y pantalla ancha: completo', () => {
    expect(decidirModo(compu)).toBe('completo');
    expect(decidirModo({ ...compu, memoria: null, nucleos: null })).toBe('completo');
  });

  it('celular, tablet o ventana angosta: liviano', () => {
    expect(decidirModo({ ...compu, punteroFino: false, ancho: 390 })).toBe('liviano');
    expect(decidirModo({ ...compu, punteroFino: false })).toBe('liviano');
    expect(decidirModo({ ...compu, ancho: 1023 })).toBe('liviano');
  });

  it.each<[string, Partial<Entorno>]>([
    ['reducir movimiento', { movimientoReducido: true }],
    ['sin WebGL', { webgl: false }],
    ['ahorro de datos', { ahorroDeDatos: true }],
    ['poca memoria', { memoria: 2 }],
    ['pocos núcleos', { nucleos: 2 }],
    ['degradada en la sesión', { degradado: true }],
  ])('%s: imagen fija', (_, cambio) => {
    expect(decidirModo({ ...compu, ...cambio })).toBe('imagen');
    expect(decidirModo({ ...compu, punteroFino: false, ancho: 390, ...cambio })).toBe('imagen');
  });
});
