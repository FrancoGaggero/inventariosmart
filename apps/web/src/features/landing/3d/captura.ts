// Página de captura de las escenas 3D (landing-3d D7), sólo para desarrollo: el exportador del
// taller la abre en Chrome sin ventana para generar la imagen fija de cada escena y tema.
// Parámetros: ?escena=deposito|como|argentina&tema=claro|oscuro&progreso=0.5&calidad=completa
//             &ancho=640&alto=520
import { cargarEscena, type NombreEscena } from './cargar';
import { leerPaleta } from './colores';
import { fuenteFija } from './progreso';

declare global {
  interface Window {
    __escenaLista?: boolean;
    __escenaError?: string;
  }
}

const q = new URLSearchParams(location.search);
const escena = (q.get('escena') ?? 'deposito') as NombreEscena;
const tema = q.get('tema') === 'claro' ? 'light' : 'dark';
document.documentElement.setAttribute('data-theme', tema);
const lienzo = document.getElementById('escena') as HTMLCanvasElement;
lienzo.style.width = `${Number(q.get('ancho') ?? 640)}px`;
lienzo.style.height = `${Number(q.get('alto') ?? 520)}px`;

cargarEscena[escena]()
  .then((iniciar) =>
    iniciar(lienzo, {
      calidad: q.get('calidad') === 'liviana' ? 'liviana' : 'completa',
      paleta: leerPaleta(tema),
      progreso: fuenteFija(Number(q.get('progreso') ?? 0.5)),
      quieta: true,
      alPerderContexto: () => (window.__escenaError = 'contexto perdido'),
      alDegradar: () => {},
      alDibujar: () => requestAnimationFrame(() => (window.__escenaLista = true)),
    }),
  )
  .catch((e: unknown) => (window.__escenaError = String(e)));
