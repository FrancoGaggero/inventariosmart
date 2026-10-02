import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { CON_INVENTARIOSMART, CON_PLANILLA, FrenteAFrente } from './FrenteAFrente';

describe('FrenteAFrente (landing-comparison D5)', () => {
  afterEach(cleanup);

  it('la sección se nombra con su título', () => {
    const { container } = render(<FrenteAFrente />);
    const titulo = screen.getByRole('heading', { level: 2 });
    expect(titulo.textContent).toBe('Dejá de apagar incendios.Manejá tu comercio con datos.');
    const seccion = container.querySelector('section')!;
    expect(seccion.getAttribute('aria-labelledby')).toBe(titulo.id);
    expect(screen.getByRole('region', { name: /Dejá de apagar incendios/ })).toBe(seccion);
  });

  it('muestra cinco ítems de cada lado, cada lista con su encabezado', () => {
    render(<FrenteAFrente />);
    const listas = screen.getAllByRole('list');
    expect(listas).toHaveLength(2);
    expect(
      within(listas[0]!)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(CON_PLANILLA);
    expect(
      within(listas[1]!)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(CON_INVENTARIOSMART);
    expect(screen.getByRole('heading', { level: 3, name: 'Con la planilla' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 3, name: 'Con InventarioSmart' })).toBeTruthy();
  });

  it('la animación es decorativa y nada se carga de otro dominio', () => {
    const { container } = render(<FrenteAFrente />);
    const animacion = container.querySelector('svg.w-\\[78\\%\\]');
    expect(animacion?.getAttribute('aria-hidden')).toBe('true');
    expect(animacion?.querySelectorAll('.anim-stock')).toHaveLength(4);
    for (const el of container.querySelectorAll('[src], [href]')) {
      const url = el.getAttribute('src') ?? el.getAttribute('href') ?? '';
      expect(url).not.toMatch(/^(https?:)?\/\//);
    }
    expect(container.querySelector('video')).toBeNull();
  });
});
