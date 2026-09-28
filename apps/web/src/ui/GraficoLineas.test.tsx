import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { extremos, GraficoLineas, type SerieGrafico } from './GraficoLineas';

const etiquetas = [
  { corta: 'ene', larga: 'enero de 2026' },
  { corta: 'feb', larga: 'febrero de 2026' },
  { corta: 'mar', larga: 'marzo de 2026' },
];
const series: SerieGrafico[] = [
  { id: 'precios', nombre: 'Mis precios', color: 'blue', valores: [100, 104.5, 118] },
  { id: 'costos', nombre: 'Mis costos', color: 'orange', valores: [100, null, 122] },
  { id: 'ipc', nombre: 'Inflación', color: 'violet', valores: [100, 108, 120], punteada: true },
];

const grafico = (s = series) =>
  render(<GraficoLineas etiquetas={etiquetas} series={s} resumen="Resumen del gráfico" />);

describe('GraficoLineas (design D8)', () => {
  afterEach(cleanup);

  it('dibuja un punto por mes con dato en cada serie', () => {
    const { container } = grafico();
    const puntos = (id: string) => container.querySelectorAll(`g[data-serie="${id}"] circle`);
    expect(puntos('precios')).toHaveLength(3);
    expect(puntos('costos')).toHaveLength(2);
    expect(puntos('ipc')).toHaveLength(3);
    expect(container.querySelectorAll('g[data-serie] path')).toHaveLength(3);
    expect(screen.getByRole('img', { name: 'Resumen del gráfico' })).toBeTruthy();
  });

  it('un mes sin dato corta la línea en lugar de unir los puntos', () => {
    const { container } = grafico();
    const trazo = container.querySelector('g[data-serie="costos"] path')!.getAttribute('d')!;
    expect(trazo.match(/M/g)).toHaveLength(2);
    expect(trazo).not.toContain('L');
  });

  it('la tabla alternativa tiene los mismos valores', () => {
    grafico();
    const filas = within(screen.getByRole('table', { hidden: true })).getAllByRole('row', {
      hidden: true,
    });
    expect(filas).toHaveLength(4);
    const textos = filas.map((f) => f.textContent);
    expect(textos[0]).toBe('MesMis preciosMis costosInflación');
    expect(textos[1]).toBe('Enero de 2026100,0100,0100,0');
    expect(textos[2]).toBe('Febrero de 2026104,5—108,0');
    expect(textos[3]).toBe('Marzo de 2026118,0122,0120,0');
  });

  it('muestra los valores del último mes y los del mes enfocado', () => {
    grafico();
    const activos = screen.getByTestId('valores-activos');
    expect(activos.textContent).toBe('Marzo de 2026118,0122,0120,0');
    fireEvent.focus(screen.getByRole('button', { name: 'Ver los valores de febrero de 2026' }));
    expect(activos.textContent).toBe('Febrero de 2026104,5—108,0');
    fireEvent.blur(screen.getByRole('button', { name: 'Ver los valores de febrero de 2026' }));
    expect(activos.textContent).toBe('Marzo de 2026118,0122,0120,0');
  });

  it('las guías del eje caen en números redondos y cubren todos los valores', () => {
    expect(extremos([100, 114.6])).toEqual({ min: 100, max: 120 });
    expect(extremos([100, 101.2])).toEqual({ min: 100, max: 110 });
    expect(extremos([96.4, 133.2])).toEqual({ min: 80, max: 160 });
    expect(extremos([100, 240])).toEqual({ min: 100, max: 300 });
    expect(extremos([])).toEqual({ min: 90, max: 110 });
  });

  it('una serie vacía no se dibuja ni aparece en la leyenda', () => {
    const { container } = grafico([{ ...series[0]!, valores: [] }, series[2]!]);
    expect(container.querySelector('g[data-serie="precios"]')).toBeNull();
    expect(container.querySelectorAll('g[data-serie="ipc"] circle')).toHaveLength(3);
    const leyenda = screen.getByRole('list', { name: 'Series del gráfico' });
    expect(
      within(leyenda)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Inflación']);
  });

  it('sin ninguna serie con datos avisa en lugar de dibujar', () => {
    const { container } = grafico([{ ...series[0]!, valores: [] }]);
    expect(container.querySelector('svg')).toBeNull();
    expect(screen.getByRole('status').textContent).toBe('Todavía no hay datos para graficar.');
  });
});
