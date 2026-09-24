import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useContador } from './useContador';

function reducedMotion(activo: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (consulta: string) => ({
      matches: activo && consulta.includes('reduce'),
      media: consulta,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

describe('useContador (design D4)', () => {
  let ahora = 0;
  let pendientes: FrameRequestCallback[] = [];

  beforeEach(() => {
    ahora = 0;
    pendientes = [];
    reducedMotion(false);
    vi.spyOn(performance, 'now').mockImplementation(() => ahora);
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      pendientes.push(cb);
      return pendientes.length;
    });
    vi.stubGlobal('cancelAnimationFrame', () => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const avanzar = (ms: number) => {
    ahora += ms;
    const lote = pendientes;
    pendientes = [];
    act(() => {
      for (const cb of lote) cb(ahora);
    });
  };

  it('sube desde el valor anterior hasta el nuevo y termina exacto', () => {
    const { result, rerender } = renderHook(({ v }) => useContador(v, 600), {
      initialProps: { v: 0 },
    });
    expect(result.current).toBe(0);
    rerender({ v: 100 });
    avanzar(150);
    const intermedio = result.current ?? 0;
    expect(intermedio).toBeGreaterThan(0);
    expect(intermedio).toBeLessThan(100);
    avanzar(300);
    expect(result.current ?? 0).toBeGreaterThan(intermedio);
    avanzar(300);
    expect(result.current).toBe(100);
    expect(pendientes).toHaveLength(0);
  });

  it('con prefers-reduced-motion devuelve el valor final de inmediato', () => {
    reducedMotion(true);
    const { result, rerender } = renderHook(({ v }) => useContador(v), {
      initialProps: { v: 0 },
    });
    rerender({ v: 42 });
    expect(result.current).toBe(42);
    expect(pendientes).toHaveLength(0);
  });

  it('un valor nulo se devuelve tal cual (dato todavía no cargado)', () => {
    const { result } = renderHook(() => useContador(null));
    expect(result.current).toBeNull();
  });
});
