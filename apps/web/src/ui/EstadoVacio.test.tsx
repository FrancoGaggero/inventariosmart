import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { EstadoVacio } from './EstadoVacio';

describe('EstadoVacio (ADR 0025)', () => {
  afterEach(() => document.documentElement.removeAttribute('data-theme'));

  it('muestra la animación del tema actual con el PNG fijo para movimiento reducido', async () => {
    const { container } = render(
      <EstadoVacio ilustracion="cajas" titulo="Todavía no hay productos." />,
    );
    const img = container.querySelector('picture img')!;
    const fuente = container.querySelector('picture source')!;
    expect(img.getAttribute('src')).toBe('/animaciones/vacio-cajas-oscuro.webp');
    expect(img.getAttribute('alt')).toBe('');
    expect(fuente.getAttribute('srcset')).toBe('/animaciones/vacio-cajas-oscuro.png');
    expect(fuente.getAttribute('media')).toBe('(prefers-reduced-motion: reduce)');
    expect(screen.getByRole('status').textContent).toContain('Todavía no hay productos.');

    await act(async () => {
      document.documentElement.setAttribute('data-theme', 'light');
      await Promise.resolve();
    });
    expect(container.querySelector('picture img')!.getAttribute('src')).toBe(
      '/animaciones/vacio-cajas-claro.webp',
    );
  });

  it('si la imagen no carga vuelve al SVG de siempre', () => {
    const { container } = render(<EstadoVacio ilustracion="campana" titulo="Sin alertas" />);
    fireEvent.error(container.querySelector('picture img')!);
    expect(container.querySelector('picture')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('animada={false} muestra el SVG fijo', () => {
    const { container } = render(
      <EstadoVacio ilustracion="recibo" titulo="Sin gastos" animada={false} />,
    );
    expect(container.querySelector('picture')).toBeNull();
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
