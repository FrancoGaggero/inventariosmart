// Motor común de las escenas 3D (landing-3d D2): renderer, tamaño, bucle bajo demanda con tope de
// cuadros, pausa, pérdida de contexto y degradación. Vive en el chunk de three; la portada sólo lo
// ve a través de `Controlador`.
import {
  MathUtils,
  NoToneMapping,
  PerspectiveCamera,
  SRGBColorSpace,
  Scene,
  WebGLRenderer,
} from 'three';
import type { Controlador, Escena, OpcionesEscena, OpcionesInicio } from '../progreso';
import { MonitorDeCuadros } from './rendimiento';

export interface Motor {
  renderer: WebGLRenderer;
  escena: Scene;
  camara: PerspectiveCamera;
  /** Ancho / alto del lienzo, para encuadrar. */
  aspecto(): number;
}

export type CrearEscena = (motor: Motor, opciones: OpcionesEscena) => Escena;

export function arrancar(
  lienzo: HTMLCanvasElement,
  crear: CrearEscena,
  opciones: OpcionesInicio,
): Controlador {
  const completa = opciones.calidad === 'completa';
  const renderer = new WebGLRenderer({
    canvas: lienzo,
    alpha: true,
    antialias: completa,
    powerPreference: completa ? 'default' : 'low-power',
    preserveDrawingBuffer: !!opciones.quieta,
  });
  const topeDpr = completa ? 2 : 1.5;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, topeDpr));
  renderer.outputColorSpace = SRGBColorSpace;
  // Sin tone mapping: el ámbar del tema tiene que verse igual que en la interfaz.
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 0);

  const camara = new PerspectiveCamera(35, 1, 0.1, 100);
  const motor: Motor = {
    renderer,
    escena: new Scene(),
    camara,
    aspecto: () => camara.aspect,
  };
  const escena = crear(motor, opciones);

  const fpsMax = completa ? 60 : 30;
  const monitor = new MonitorDeCuadros(1 / fpsMax);
  let actual = opciones.progreso.get();
  let cuadro = 0;
  let ultimo = 0;
  let pausada = false;
  let terminado = false;
  let dibujado = false;

  function dimensionar() {
    const ancho = lienzo.clientWidth || 1;
    const alto = lienzo.clientHeight || 1;
    renderer.setSize(ancho, alto, false);
    camara.aspect = ancho / alto;
    camara.updateProjectionMatrix();
    invalidar();
  }

  function paso(ahora: number) {
    cuadro = 0;
    if (pausada || terminado) return;
    const dt = ultimo ? Math.min((ahora - ultimo) / 1000, 0.1) : 1 / fpsMax;
    // Tope de cuadros: en liviano se dibuja como mucho a 30 por segundo.
    if (ultimo && ahora - ultimo < 1000 / fpsMax - 2) {
      cuadro = requestAnimationFrame(paso);
      return;
    }
    const continuo = ultimo !== 0 && ahora - ultimo < 250;
    ultimo = ahora;
    const objetivo = opciones.progreso.get();
    actual = opciones.quieta ? objetivo : MathUtils.damp(actual, objetivo, 6, dt);
    if (Math.abs(actual - objetivo) < 1e-4) actual = objetivo;
    const sigue = escena.actualizar(actual, dt);
    renderer.render(motor.escena, camara);
    if (!dibujado) {
      dibujado = true;
      opciones.alDibujar?.();
    }
    if (continuo && !opciones.quieta) {
      const ajuste = monitor.medir(dt);
      if (ajuste === 'bajarResolucion') renderer.setPixelRatio(1);
      if (ajuste === 'degradar') opciones.alDegradar();
    }
    if (sigue || actual !== objetivo) cuadro = requestAnimationFrame(paso);
    else ultimo = 0;
  }

  function invalidar() {
    if (!cuadro && !pausada && !terminado) cuadro = requestAnimationFrame(paso);
  }

  const alPerder = (e: Event) => {
    e.preventDefault();
    opciones.alPerderContexto();
  };
  lienzo.addEventListener('webglcontextlost', alPerder);
  const observador = new ResizeObserver(dimensionar);
  observador.observe(lienzo);
  const dejarDeEscuchar = opciones.progreso.on('change', invalidar);
  dimensionar();

  return {
    pausar(valor) {
      pausada = valor;
      if (valor) {
        cancelAnimationFrame(cuadro);
        cuadro = 0;
        ultimo = 0;
      } else invalidar();
    },
    setPaleta(paleta) {
      escena.setPaleta(paleta);
      invalidar();
    },
    setPuntero(x, y) {
      if (!completa || !escena.setPuntero) return;
      escena.setPuntero(x, y);
      invalidar();
    },
    dispose() {
      terminado = true;
      cancelAnimationFrame(cuadro);
      dejarDeEscuchar();
      observador.disconnect();
      escena.dispose();
      renderer.dispose();
      // Sin el listener, para que liberar el contexto no se confunda con una pérdida real.
      lienzo.removeEventListener('webglcontextlost', alPerder);
      renderer.forceContextLoss();
    },
  };
}
