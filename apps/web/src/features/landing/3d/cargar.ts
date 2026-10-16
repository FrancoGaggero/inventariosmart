// Única puerta al chunk de three (landing-3d D1): la portada importa este módulo, nunca three. Cada
// escena es un import dinámico; los tests lo reemplazan para no cargar WebGL en jsdom.
import type { Iniciar } from './progreso';

export const cargarEscena = {
  deposito: (): Promise<Iniciar> => import('./escenas/deposito').then((m) => m.iniciar),
  como: (): Promise<Iniciar> => import('./escenas/comoFunciona').then((m) => m.iniciar),
  argentina: (): Promise<Iniciar> => import('./escenas/argentina').then((m) => m.iniciar),
};

export type NombreEscena = keyof typeof cargarEscena;
