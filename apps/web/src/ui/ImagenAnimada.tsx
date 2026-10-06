import { type ReactNode, useState } from 'react';
import { sufijoDeTema, useTemaActual } from '@/lib/tema-actual';

/** Ruta de una animación de `public/animaciones/` (ADR 0025). */
export const rutaAnimacion = (nombre: string, tema: 'claro' | 'oscuro', ext: 'webp' | 'png') =>
  `${import.meta.env.BASE_URL}animaciones/${nombre}-${tema}.${ext}`;

/**
 * Animación generada en `herramientas/visuales` (WebP con transparencia) del tema actual. Con
 * movimiento reducido el navegador elige el PNG fijo; si la imagen no carga, muestra el respaldo.
 * Es decorativa: el texto de la pantalla dice lo que importa.
 */
export function ImagenAnimada({
  nombre,
  ancho,
  alto,
  respaldo,
  className,
}: {
  nombre: string;
  ancho: number;
  alto: number;
  respaldo: ReactNode;
  className?: string;
}) {
  const tema = sufijoDeTema(useTemaActual());
  const [fallo, setFallo] = useState(false);
  if (fallo) return <>{respaldo}</>;
  return (
    <picture className={className}>
      <source
        srcSet={rutaAnimacion(nombre, tema, 'png')}
        media="(prefers-reduced-motion: reduce)"
      />
      <img
        src={rutaAnimacion(nombre, tema, 'webp')}
        width={ancho}
        height={alto}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onError={() => setFallo(true)}
      />
    </picture>
  );
}
