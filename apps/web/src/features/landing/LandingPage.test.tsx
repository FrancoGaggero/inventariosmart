import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type * as ModuloModo from './3d/modo';
import { LandingPage } from './LandingPage';

// Las escenas nunca se cargan en jsdom: así three no llega a los tests (landing-3d D8).
vi.mock('./3d/cargar', () => {
  const nunca = () => new Promise(() => {});
  return { cargarEscena: { deposito: nunca, como: nunca, argentina: nunca } };
});
vi.mock('./3d/modo', async (original) => ({
  ...(await original<typeof ModuloModo>()),
  leerEntorno: () => ({
    movimientoReducido: false,
    webgl: false,
    punteroFino: false,
    ancho: 390,
    ahorroDeDatos: false,
    memoria: null,
    nucleos: null,
    degradado: false,
  }),
}));

function montar() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe('portada con escenas 3D (landing-3d)', () => {
  afterEach(cleanup);

  it('el título y los cuatro pasos están en el texto', () => {
    const { container } = montar();
    expect(container.querySelector('h1')?.getAttribute('aria-label')).toBe(
      'Tu stock y tus números reales, en un solo lugar.',
    );
    const como = container.querySelector('#como')!.textContent!;
    for (const paso of [
      'Importá tu planilla',
      'Registrá lo que vendés',
      'Te avisa antes de que falte',
      'Mandá la orden por WhatsApp',
    ]) {
      expect(como).toContain(paso);
    }
    expect(como).toContain('Cuatro pasos');
  });

  it('"Hecho para Argentina" dice las ciudades y rotula los datos de ejemplo', () => {
    const { container } = montar();
    const seccion = container.querySelector('section#argentina')!;
    expect(seccion.getAttribute('aria-labelledby')).toBe('titulo-argentina');
    for (const ciudad of ['AMBA', 'Córdoba', 'Rosario', 'Mendoza']) {
      expect(seccion.textContent).toContain(ciudad);
    }
    expect(seccion.textContent).toContain('Datos de ejemplo');
    expect(seccion.textContent).toContain('en términos reales');
    expect(container.querySelector('nav a[href="#argentina"]')).not.toBeNull();
  });

  it('las escenas van ocultas para lectores y sin three ni recursos externos', () => {
    const { container } = montar();
    const imagenes = [...container.querySelectorAll('img[src*="escena-"]')];
    expect(imagenes.length).toBe(3);
    for (const img of imagenes) expect(img.getAttribute('aria-hidden')).toBe('true');
    for (const el of container.querySelectorAll('[src], [href]')) {
      const destino = el.getAttribute('src') ?? el.getAttribute('href')!;
      expect(destino, destino).not.toMatch(/^(https?:)?\/\//);
    }
    expect((window as Window & { __THREE__?: string }).__THREE__).toBeUndefined();
  });

  it('la marquesina se lee una sola vez', () => {
    const { container } = montar();
    const listas = container.querySelectorAll(
      'ul[aria-label="Rubros de los comercios que validaron la idea"]',
    );
    expect(listas.length).toBe(1);
  });
});
