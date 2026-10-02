import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { Animado } from './Animado';
import { TextoQueSeArma } from './TextoQueSeArma';

describe('TextoQueSeArma (landing-motion D2)', () => {
  afterEach(cleanup);

  it('expone el texto completo y oculta las palabras sueltas a los lectores de pantalla', () => {
    const { container } = render(
      <Animado>
        <TextoQueSeArma
          partes={[
            { texto: 'Tu stock y tus' },
            { texto: 'números reales', className: 'acento-serif' },
            { texto: ', en un solo lugar.' },
          ]}
        />
      </Animado>,
    );
    const titulo = screen.getByRole('heading', { level: 1 });
    expect(titulo.getAttribute('aria-label')).toBe(
      'Tu stock y tus números reales, en un solo lugar.',
    );
    const palabras = container.querySelectorAll('h1 [aria-hidden]');
    expect(palabras.length).toBe(11);
    const serif = [...container.querySelectorAll('.acento-serif')].map((e) => e.textContent);
    expect(serif).toEqual(['números', 'reales']);
    // Lo que se ve es el mismo texto, sin espacio antes de la coma.
    expect(titulo.textContent).toBe('Tu stock y tus números reales, en un solo lugar.');
  });
});
