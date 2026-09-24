import { beforeEach, describe, expect, it, vi } from 'vitest';
import { aplicarTema, guardarTema, leerTema } from './tema';

function sistemaPrefiere(claro: boolean) {
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (consulta: string) => ({
      matches: claro && consulta.includes('light'),
      media: consulta,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }),
  });
}

describe('tema (design D2)', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    sistemaPrefiere(false);
  });

  it('sin preferencia guardada usa la del sistema', () => {
    expect(leerTema()).toBe('dark');
    sistemaPrefiere(true);
    expect(leerTema()).toBe('light');
  });

  it('la preferencia guardada manda sobre la del sistema', () => {
    sistemaPrefiere(true);
    guardarTema('dark');
    expect(leerTema()).toBe('dark');
    guardarTema('light');
    expect(leerTema()).toBe('light');
  });

  it('un valor guardado inválido se ignora', () => {
    localStorage.setItem('tema', 'sepia');
    expect(leerTema()).toBe('dark');
  });

  it('aplicarTema pone y saca el atributo del documento', () => {
    aplicarTema('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.style.colorScheme).toBe('light');
    aplicarTema('dark');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('dark');
  });
});
