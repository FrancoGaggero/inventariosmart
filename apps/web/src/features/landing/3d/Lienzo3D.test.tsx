import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarEscena } from './cargar';
import { Lienzo3D } from './Lienzo3D';
import type * as ModuloModo from './modo';
import { type Entorno, leerEntorno } from './modo';

vi.mock('./cargar', () => ({
  cargarEscena: { deposito: vi.fn(), como: vi.fn(), argentina: vi.fn() },
}));
vi.mock('./modo', async (original) => ({
  ...(await original<typeof ModuloModo>()),
  leerEntorno: vi.fn(),
}));

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

const matchMediaOriginal = window.matchMedia;
function reducirMovimiento(activo: boolean) {
  window.matchMedia = ((q: string) => ({
    ...matchMediaOriginal(q),
    matches: activo && q.includes('prefers-reduced-motion'),
  })) as typeof window.matchMedia;
}

const deposito = vi.mocked(cargarEscena.deposito);

function montar() {
  return render(
    <Lienzo3D escena="deposito" prioridad="cercania" imagen={{ ancho: 640, alto: 520 }} />,
  );
}

describe('Lienzo3D (landing-3d D2)', () => {
  beforeEach(() => {
    vi.mocked(leerEntorno).mockReturnValue(compu);
    reducirMovimiento(false);
    deposito.mockReset();
    document.documentElement.removeAttribute('data-theme');
  });
  afterEach(() => {
    cleanup();
    window.matchMedia = matchMediaOriginal;
  });

  it('sin WebGL muestra la imagen fija del tema y no baja la escena', async () => {
    vi.mocked(leerEntorno).mockReturnValue({ ...compu, webgl: false });
    const { container } = montar();
    const img = container.querySelector('img')!;
    expect(img.getAttribute('src')).toContain('/animaciones/escena-deposito-oscuro.png');
    expect(img.getAttribute('alt')).toBe('');
    expect(img.getAttribute('aria-hidden')).toBe('true');
    expect(deposito).not.toHaveBeenCalled();

    act(() => document.documentElement.setAttribute('data-theme', 'light'));
    await waitFor(() =>
      expect(container.querySelector('img')!.getAttribute('src')).toContain(
        'escena-deposito-claro.png',
      ),
    );
  });

  it('con "reducir movimiento" muestra la imagen fija y no baja la escena', () => {
    reducirMovimiento(true);
    const { container } = montar();
    expect(container.querySelector('img')).not.toBeNull();
    expect(container.querySelector('canvas')).toBeNull();
    expect(deposito).not.toHaveBeenCalled();
  });

  it('con WebGL baja la escena y la inicia en un lienzo oculto para lectores', async () => {
    const controlador = {
      pausar: vi.fn(),
      setPaleta: vi.fn(),
      setPuntero: vi.fn(),
      dispose: vi.fn(),
    };
    const iniciar = vi.fn(() => controlador);
    deposito.mockResolvedValue(iniciar);
    const { container, unmount } = montar();
    await waitFor(() => expect(iniciar).toHaveBeenCalledTimes(1));
    const contenedor = container.firstElementChild!;
    expect(contenedor.getAttribute('aria-hidden')).toBe('true');
    expect(contenedor.getAttribute('data-modo')).toBe('completo');
    expect(container.querySelector('canvas')).not.toBeNull();
    expect(container.querySelector('img')).toBeNull();
    const [, opciones] = iniciar.mock.calls[0] as unknown as [
      HTMLCanvasElement,
      { calidad: string },
    ];
    expect(opciones.calidad).toBe('completa');
    unmount();
    expect(controlador.dispose).toHaveBeenCalled();
  });

  it('en un celular inicia la escena liviana', async () => {
    vi.mocked(leerEntorno).mockReturnValue({ ...compu, punteroFino: false, ancho: 390 });
    const iniciar = vi.fn(() => ({ pausar() {}, setPaleta() {}, setPuntero() {}, dispose() {} }));
    deposito.mockResolvedValue(iniciar);
    montar();
    await waitFor(() => expect(iniciar).toHaveBeenCalled());
    const [, opciones] = iniciar.mock.calls[0] as unknown as [
      HTMLCanvasElement,
      { calidad: string },
    ];
    expect(opciones.calidad).toBe('liviana');
  });

  it('si el chunk no baja, vuelve a la imagen fija', async () => {
    deposito.mockRejectedValue(new Error('sin red'));
    const { container } = montar();
    await waitFor(() => expect(container.querySelector('img')).not.toBeNull());
    expect(container.querySelector('canvas')).toBeNull();
  });
});
