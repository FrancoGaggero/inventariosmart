import { useCallback, useEffect, useState } from 'react';

export type Tema = 'dark' | 'light';

const CLAVE = 'tema';

/** Color de la barra del navegador en el celular: el fondo de cada tema (index.css). */
export const COLOR_BARRA: Record<Tema, string> = { dark: '#14110d', light: '#f4efe6' };

function guardado(): Tema | null {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === 'dark' || v === 'light' ? v : null;
  } catch {
    return null;
  }
}

/** Preferencia guardada; si no hay, la del sistema; si no se puede saber, oscuro. */
export function leerTema(): Tema {
  const g = guardado();
  if (g) return g;
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  return 'dark';
}

/** Aplica el tema al documento (atributo `data-theme`, `color-scheme` y `theme-color`). */
export function aplicarTema(tema: Tema): void {
  const raiz = document.documentElement;
  if (tema === 'light') raiz.setAttribute('data-theme', 'light');
  else raiz.removeAttribute('data-theme');
  raiz.style.colorScheme = tema;
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = COLOR_BARRA[tema];
}

export function guardarTema(tema: Tema): void {
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    // Sin almacenamiento (modo privado): el tema dura la sesión.
  }
}

/** Tema actual y conmutador con persistencia (design D2). */
export function useTema(): { tema: Tema; alternar: () => void } {
  const [tema, setTema] = useState<Tema>(() => leerTema());
  useEffect(() => {
    aplicarTema(tema);
  }, [tema]);
  const alternar = useCallback(() => {
    setTema((t) => {
      const nuevo: Tema = t === 'dark' ? 'light' : 'dark';
      guardarTema(nuevo);
      return nuevo;
    });
  }, []);
  return { tema, alternar };
}
