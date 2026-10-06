import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as tema from './tema';
import { sufijoDeTema, useTemaActual } from './tema-actual';

describe('useTemaActual', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
    vi.restoreAllMocks();
  });

  it('lee data-theme, sigue sus cambios y no aplica el tema', async () => {
    const aplicar = vi.spyOn(tema, 'aplicarTema');
    const { result } = renderHook(() => useTemaActual());
    expect(result.current).toBe('dark');

    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'light');
      await Promise.resolve();
    });
    expect(result.current).toBe('light');

    await act(async () => {
      document.documentElement.removeAttribute('data-theme');
      await Promise.resolve();
    });
    expect(result.current).toBe('dark');
    expect(aplicar).not.toHaveBeenCalled();
  });

  it('traduce el tema al sufijo de los archivos', () => {
    expect(sufijoDeTema('light')).toBe('claro');
    expect(sufijoDeTema('dark')).toBe('oscuro');
  });
});
