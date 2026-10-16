import { Component, type ReactNode, useEffect, useRef, useState } from 'react';
import { useMedia } from '@/features/publico/useMedia';
import { sufijoDeTema, useTemaActual } from '@/lib/tema-actual';
import { rutaAnimacion } from '@/ui/ImagenAnimada';
import { cargarEscena, type NombreEscena } from './cargar';
import { leerPaleta } from './colores';
import { decidirModo, leerEntorno, marcarDegradado, type Modo } from './modo';
import { type Controlador, type FuenteDeProgreso, fuenteFija } from './progreso';

export interface PropsLienzo3D {
  escena: NombreEscena;
  /** Avance del scroll de la sección (un MotionValue sirve); sin él, la escena queda en 0. */
  progreso?: FuenteDeProgreso;
  /** Cuándo bajar el chunk: en idle (el hero) o cuando la sección se acerca. */
  prioridad: 'idle' | 'cercania';
  /** Medidas de la imagen fija, para reservar el lugar sin saltos. */
  imagen: { ancho: number; alto: number };
  className?: string;
}

const CLASE_LIENZO = 'absolute inset-0 w-full h-full block';

/**
 * Escena 3D decorativa de la portada (landing-3d D2). Decide el modo (completo, liviano o imagen
 * fija), baja el chunk de three sólo cuando hace falta, pausa la escena fuera de pantalla, la
 * desmonta cuando queda lejos y vuelve a la imagen fija si algo falla.
 */
export function Lienzo3D(props: PropsLienzo3D) {
  const [fallo, setFallo] = useState(false);
  return (
    <Contencion alFallar={() => setFallo(true)} fallback={<ImagenFija {...props} />}>
      <LienzoInterno {...props} fallo={fallo} alFallar={() => setFallo(true)} />
    </Contencion>
  );
}

function ImagenFija({ escena, imagen, className }: PropsLienzo3D) {
  const tema = sufijoDeTema(useTemaActual());
  const [oculta, setOculta] = useState(false);
  if (oculta) return null;
  return (
    <img
      src={rutaAnimacion(`escena-${escena}`, tema, 'png')}
      width={imagen.ancho}
      height={imagen.alto}
      alt=""
      aria-hidden="true"
      loading="lazy"
      decoding="async"
      fetchPriority="low"
      draggable={false}
      className={`pointer-events-none select-none object-contain ${className ?? ''}`}
      onError={() => setOculta(true)}
    />
  );
}

function LienzoInterno(props: PropsLienzo3D & { fallo: boolean; alFallar: () => void }) {
  const { escena, progreso, prioridad, className, fallo, alFallar } = props;
  const reducido = useMedia('(prefers-reduced-motion: reduce)');
  const [entorno] = useState(leerEntorno);
  const modo: Modo = reducido || fallo ? 'imagen' : decidirModo(entorno);
  const tema = useTemaActual();
  const contenedor = useRef<HTMLDivElement>(null);
  const controlador = useRef<Controlador | null>(null);
  const temaActual = useRef(tema);
  temaActual.current = tema;
  const fuente = useRef<FuenteDeProgreso>(progreso ?? fuenteFija(0));
  fuente.current = progreso ?? fuente.current;
  const avisarFallo = useRef(alFallar);
  avisarFallo.current = alFallar;

  useEffect(() => {
    const cont = contenedor.current;
    if (modo === 'imagen' || !cont) return;
    let lienzo: HTMLCanvasElement | null = null;
    let cargando = false;
    let terminado = false;
    let disparado = false;
    let lejos = false;
    let visible = true;

    const pausarSiCorresponde = () =>
      controlador.current?.pausar(!visible || document.visibilityState === 'hidden');

    const desmontar = () => {
      controlador.current?.dispose();
      controlador.current = null;
      lienzo?.remove();
      lienzo = null;
    };

    const caer = () => {
      desmontar();
      if (!terminado) avisarFallo.current();
    };

    // Cada montaje usa un canvas nuevo: uno al que se le liberó el contexto no sirve otra vez.
    const montar = () => {
      if (controlador.current || cargando || terminado || lejos) return;
      cargando = true;
      cargarEscena[escena]()
        .then((iniciar) => {
          cargando = false;
          if (terminado || lejos) return;
          const nuevo = document.createElement('canvas');
          nuevo.className = CLASE_LIENZO;
          nuevo.tabIndex = -1;
          nuevo.style.opacity = '0';
          nuevo.style.transition = 'opacity 700ms ease';
          cont.appendChild(nuevo);
          lienzo = nuevo;
          controlador.current = iniciar(nuevo, {
            calidad: modo === 'completo' ? 'completa' : 'liviana',
            paleta: leerPaleta(temaActual.current),
            progreso: fuente.current,
            alPerderContexto: caer,
            alDegradar: () => {
              marcarDegradado();
              caer();
            },
            alDibujar: () => {
              nuevo.style.opacity = '1';
            },
          });
          pausarSiCorresponde();
        })
        .catch(caer);
    };

    const dejarDeEsperar = esperar(prioridad, modo, cont, () => {
      disparado = true;
      montar();
    });

    // Pausa fuera de pantalla y con la pestaña oculta; a más de dos pantallas de distancia,
    // libera el contexto (el navegador permite pocos a la vez).
    const vista = new IntersectionObserver(([e]) => {
      visible = !!e?.isIntersecting;
      pausarSiCorresponde();
    });
    vista.observe(cont);
    const distancia = new IntersectionObserver(
      ([e]) => {
        lejos = !e?.isIntersecting;
        if (lejos) desmontar();
        else if (disparado) montar();
      },
      { rootMargin: '200% 0px' },
    );
    distancia.observe(cont);
    document.addEventListener('visibilitychange', pausarSiCorresponde);

    return () => {
      terminado = true;
      dejarDeEsperar();
      vista.disconnect();
      distancia.disconnect();
      document.removeEventListener('visibilitychange', pausarSiCorresponde);
      desmontar();
    };
  }, [modo, escena, prioridad]);

  useEffect(() => {
    controlador.current?.setPaleta(leerPaleta(tema));
  }, [tema]);

  useEffect(() => {
    if (modo !== 'completo') return;
    const mover = (e: PointerEvent) =>
      controlador.current?.setPuntero(
        (e.clientX / window.innerWidth) * 2 - 1,
        (e.clientY / window.innerHeight) * 2 - 1,
      );
    window.addEventListener('pointermove', mover, { passive: true });
    return () => window.removeEventListener('pointermove', mover);
  }, [modo]);

  if (modo === 'imagen') return <ImagenFija {...props} />;
  return (
    <div
      ref={contenedor}
      aria-hidden="true"
      data-modo={modo}
      className={`pointer-events-none select-none ${className ?? ''}`}
    />
  );
}

/**
 * Cuándo arrancar la escena. El hero espera a que la página termine de cargar y el navegador esté
 * libre (en el celular, además, al primer gesto o a los 3 s); las otras, a que la sección se acerque.
 */
function esperar(
  prioridad: 'idle' | 'cercania',
  modo: Modo,
  cont: HTMLElement,
  listo: () => void,
): () => void {
  if (prioridad === 'cercania') {
    const cerca = new IntersectionObserver(
      ([e]) => {
        if (!e?.isIntersecting) return;
        cerca.disconnect();
        listo();
      },
      { rootMargin: '100% 0px' },
    );
    cerca.observe(cont);
    return () => cerca.disconnect();
  }

  const limpiezas: (() => void)[] = [];
  let lanzado = false;
  const enIdle = () => {
    if (lanzado) return;
    lanzado = true;
    const lanzar = () => listo();
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(lanzar, { timeout: 2500 });
      limpiezas.push(() => window.cancelIdleCallback(id));
    } else {
      const id = window.setTimeout(lanzar, 1200);
      limpiezas.push(() => window.clearTimeout(id));
    }
  };
  const tras = (evento: string, objetivo: Window, f: () => void) => {
    objetivo.addEventListener(evento, f, { once: true, passive: true });
    limpiezas.push(() => objetivo.removeEventListener(evento, f));
  };

  if (modo === 'liviano') {
    tras('scroll', window, enIdle);
    tras('pointerdown', window, enIdle);
    const id = window.setTimeout(enIdle, 3000);
    limpiezas.push(() => window.clearTimeout(id));
  } else if (document.readyState === 'complete') {
    enIdle();
  } else {
    tras('load', window, enIdle);
  }
  return () => limpiezas.forEach((f) => f());
}

/** Si la escena rompe al renderizar, la portada sigue con la imagen fija. */
class Contencion extends Component<
  { children: ReactNode; fallback: ReactNode; alFallar: () => void },
  { roto: boolean }
> {
  override state = { roto: false };
  static getDerivedStateFromError() {
    return { roto: true };
  }
  override componentDidCatch() {
    this.props.alFallar();
  }
  override render() {
    return this.state.roto ? this.props.fallback : this.props.children;
  }
}
