// Datos de ejemplo de la cinta de "Hecho para Argentina" (landing-3d D5). Son inventados y la
// portada los rotula "Datos de ejemplo": no son cifras del INDEC ni de ningún comercio, y la
// portada no consulta la API.
import { indiceBase100, variacionReal } from '@inventariosmart/shared';
import { formatearVariacion } from '@/lib/inflacion-formato';

export const MESES_EJEMPLO = 12;

/** Variación mensual en porcentaje: inflación de referencia y la de los precios del comercio. */
const IPC_MENSUAL = [2.4, 2.2, 2.6, 2.1, 1.9, 2.3, 2.0, 1.8, 2.2, 1.9, 1.7, 2.0];
const PRECIOS_MENSUAL = [0, 3.5, 0, 0, 4.0, 0, 0, 2.5, 0, 0, 3.0, 0];

/** Niveles acumulados en índice base 100 al primer mes. */
function acumular(mensual: number[]): number[] {
  const niveles = [100];
  for (let i = 1; i < mensual.length; i++) niveles.push(niveles[i - 1]! * (1 + mensual[i]! / 100));
  return niveles;
}

export const IPC_EJEMPLO = indiceBase100(acumular(IPC_MENSUAL)).map(Number);
export const PRECIOS_EJEMPLO = indiceBase100(acumular(PRECIOS_MENSUAL)).map(Number);

const variacion = (serie: number[]) => serie[serie.length - 1]! - 100;

/** Frase de la cinta con la variación real de RN-11. */
export function fraseDeEjemplo(): string {
  const ipc = variacion(IPC_EJEMPLO);
  const precios = variacion(PRECIOS_EJEMPLO);
  const real = Number(variacionReal(precios, ipc));
  const estado =
    real < 0
      ? `quedaste ${formatearVariacion(real)} atrasado`
      : `le ganaste ${formatearVariacion(real)} a la inflación`;
  return `En este ejemplo de ${MESES_EJEMPLO} meses la inflación fue ${formatearVariacion(ipc)} y tus precios subieron ${formatearVariacion(precios)}: en términos reales ${estado}.`;
}
