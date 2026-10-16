// Contrato entre la portada y las escenas 3D (landing-3d D2). Las escenas no importan React ni
// Motion: reciben el avance del scroll por esta interfaz, que un MotionValue<number> ya cumple.

import type { PaletaEscena } from './colores';

export interface FuenteDeProgreso {
  get(): number;
  on(evento: 'change', alCambiar: (valor: number) => void): () => void;
}

/** Progreso que no cambia: para la captura de la imagen fija y para las pruebas. */
export function fuenteFija(valor: number): FuenteDeProgreso {
  return { get: () => valor, on: () => () => {} };
}

export type Calidad = 'completa' | 'liviana';

export interface Escena {
  /**
   * Dibuja el estado para ese progreso (0 a 1). `dt` son los segundos desde el cuadro anterior.
   * Devuelve true mientras algo se siga moviendo solo (la entrada o un pulso).
   */
  actualizar(progreso: number, dt: number): boolean;
  setPaleta(paleta: PaletaEscena): void;
  /** Posición del mouse de -1 a 1 en cada eje; sólo con calidad completa. */
  setPuntero?(x: number, y: number): void;
  dispose(): void;
}

export interface OpcionesEscena {
  calidad: Calidad;
  paleta: PaletaEscena;
  /** Sin entrada ni pulsos: el estado del progreso tal cual (captura de la imagen fija). */
  quieta?: boolean;
}

export interface OpcionesInicio extends OpcionesEscena {
  progreso: FuenteDeProgreso;
  /** El navegador perdió el contexto WebGL (memoria, GPU): la portada pasa a la imagen fija. */
  alPerderContexto(): void;
  /** Los cuadros siguen lentos después de bajar la resolución. */
  alDegradar(): void;
  /** Para la captura: avisa después del primer cuadro dibujado. */
  alDibujar?(): void;
}

/** Lo que la portada maneja de una escena en marcha; lo devuelve `iniciar` del chunk 3D. */
export interface Controlador {
  pausar(pausada: boolean): void;
  setPaleta(paleta: PaletaEscena): void;
  setPuntero(x: number, y: number): void;
  dispose(): void;
}

export type Iniciar = (lienzo: HTMLCanvasElement, opciones: OpcionesInicio) => Controlador;
