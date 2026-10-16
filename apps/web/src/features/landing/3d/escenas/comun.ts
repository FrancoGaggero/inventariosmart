// Piezas compartidas por las escenas 3D (landing-3d D3 a D5).
import {
  CanvasTexture,
  Color,
  DirectionalLight,
  HemisphereLight,
  type Material,
  type Object3D,
  SRGBColorSpace,
  type Scene,
} from 'three';
import type { PaletaEscena } from '../colores';

/** Luz barata para todas las escenas: cielo cálido, suelo del fondo y un sol de costado. */
export function luces(escena: Scene, paleta: PaletaEscena) {
  const cielo = new HemisphereLight(0xfff4e2, new Color(paleta.bg), 1.6);
  const sol = new DirectionalLight(0xffffff, 1.5);
  sol.position.set(3, 6, 4);
  escena.add(cielo, sol);
  return {
    setPaleta(p: PaletaEscena) {
      cielo.groundColor.set(p.bg);
    },
  };
}

/** Sombra de contacto: un degradé radial generado en un canvas de 256 px, sin archivos. */
export function texturaSombra(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const d = g.createRadialGradient(128, 128, 0, 128, 128, 128);
    d.addColorStop(0, 'rgba(0,0,0,0.45)');
    d.addColorStop(0.6, 'rgba(0,0,0,0.12)');
    d.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = d;
    g.fillRect(0, 0, 256, 256);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Libera geometrías, materiales y texturas de un árbol de objetos. */
export function liberar(raiz: Object3D) {
  raiz.traverse((o) => {
    const malla = o as Object3D & {
      geometry?: { dispose(): void };
      material?: Material | Material[];
    };
    malla.geometry?.dispose();
    const materiales = Array.isArray(malla.material)
      ? malla.material
      : malla.material
        ? [malla.material]
        : [];
    for (const m of materiales) {
      for (const valor of Object.values(m)) {
        if (valor && typeof valor === 'object' && 'isTexture' in valor)
          (valor as { dispose(): void }).dispose();
      }
      m.dispose();
    }
  });
}

/** Aproxima un valor a otro con amortiguación exponencial; devuelve si todavía falta. */
export function acercar(actual: { v: number }, objetivo: number, dt: number, rapidez = 6): boolean {
  actual.v += (objetivo - actual.v) * (1 - Math.exp(-rapidez * dt));
  if (Math.abs(objetivo - actual.v) < 1e-4) {
    actual.v = objetivo;
    return false;
  }
  return true;
}

/** Distancia de cámara para que un ancho y un alto entren en un campo vertical dado. */
export function distanciaPara(ancho: number, alto: number, fov: number, aspecto: number): number {
  const t = Math.tan(((fov / 2) * Math.PI) / 180);
  return Math.max(alto / (2 * t), ancho / (2 * t * aspecto));
}
