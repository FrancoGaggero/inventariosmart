// Qué versión de las escenas 3D corresponde a cada dispositivo (landing-3d D2). La decisión es una
// función pura; leer el navegador queda aparte para poder probarla con cualquier combinación.

export type Modo = 'completo' | 'liviano' | 'imagen';

export interface Entorno {
  movimientoReducido: boolean;
  webgl: boolean;
  punteroFino: boolean;
  ancho: number;
  ahorroDeDatos: boolean;
  /** GB informados por `navigator.deviceMemory`; null si el navegador no lo dice. */
  memoria: number | null;
  nucleos: number | null;
  /** La escena ya anduvo lenta o perdió el contexto en esta sesión. */
  degradado: boolean;
}

export const CLAVE_DEGRADADO = 'escenas3d:degradado';

export function decidirModo(e: Entorno): Modo {
  if (
    e.movimientoReducido ||
    !e.webgl ||
    e.ahorroDeDatos ||
    e.degradado ||
    (e.memoria !== null && e.memoria <= 2) ||
    (e.nucleos !== null && e.nucleos <= 2)
  ) {
    return 'imagen';
  }
  return e.punteroFino && e.ancho >= 1024 ? 'completo' : 'liviano';
}

let webglEnCache: boolean | null = null;

/**
 * Si el navegador da un contexto WebGL sin advertencia de rendimiento. Se pide una sola vez y el
 * contexto se libera enseguida para no ocupar uno de los pocos que permite el navegador.
 */
export function soportaWebGL(): boolean {
  if (webglEnCache !== null) return webglEnCache;
  try {
    const lienzo = document.createElement('canvas');
    const opciones = { failIfMajorPerformanceCaveat: true };
    const gl = (lienzo.getContext('webgl2', opciones) ?? lienzo.getContext('webgl', opciones)) as
      WebGLRenderingContext | WebGL2RenderingContext | null;
    webglEnCache = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webglEnCache = false;
  }
  return webglEnCache;
}

function consulta(q: string): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(q).matches;
}

function leerSesion(clave: string): boolean {
  try {
    return window.sessionStorage.getItem(clave) === '1';
  } catch {
    return false;
  }
}

/** Marca la sesión para que las escenas vuelvan a la imagen fija hasta cerrar la pestaña. */
export function marcarDegradado(): void {
  try {
    window.sessionStorage.setItem(CLAVE_DEGRADADO, '1');
  } catch {
    // Sin almacenamiento (modo privado estricto): la escena igual pasa a imagen en esta visita.
  }
}

export function leerEntorno(): Entorno {
  const nav = navigator as Navigator & {
    connection?: { saveData?: boolean };
    deviceMemory?: number;
  };
  return {
    movimientoReducido: consulta('(prefers-reduced-motion: reduce)'),
    webgl: soportaWebGL(),
    punteroFino: consulta('(pointer: fine)'),
    ancho: window.innerWidth,
    ahorroDeDatos: nav.connection?.saveData === true,
    memoria: typeof nav.deviceMemory === 'number' ? nav.deviceMemory : null,
    nucleos: typeof nav.hardwareConcurrency === 'number' ? nav.hardwareConcurrency : null,
    degradado: leerSesion(CLAVE_DEGRADADO),
  };
}
