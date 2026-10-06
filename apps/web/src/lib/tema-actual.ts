import { useSyncExternalStore } from 'react';
import type { Tema } from './tema';

/**
 * Tema aplicado al documento, sólo de lectura (design D4 de app-animations). `useTema` guarda su
 * propio estado y aplica el tema en un efecto, así que no sirve para leerlo desde otro componente:
 * acá se lee `data-theme` y se escucha su cambio.
 */
function leer(): Tema {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function suscribir(aviso: () => void): () => void {
  if (typeof MutationObserver === 'undefined') return () => {};
  const observador = new MutationObserver(aviso);
  observador.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });
  return () => observador.disconnect();
}

export function useTemaActual(): Tema {
  return useSyncExternalStore(suscribir, leer, () => 'dark');
}

/** Sufijo de los archivos de `public/animaciones/`. */
export const sufijoDeTema = (tema: Tema): 'claro' | 'oscuro' =>
  tema === 'light' ? 'claro' : 'oscuro';
