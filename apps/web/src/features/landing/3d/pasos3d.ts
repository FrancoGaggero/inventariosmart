// Sincronía entre la escena de "Cómo funciona" y la lista de pasos (landing-3d D4): los dos usan
// los mismos tramos del scroll de `tramoDePaso`, así nunca se desfasan.
import { tramoDePaso } from '@/lib/animacion';

export interface EstadoDePaso {
  /** Cuánto está encendido cada paso, de 0 a 1, igual que la tarjeta de la lista. */
  pesos: number[];
  /** El paso más encendido. */
  indice: number;
  /** Avance dentro del paso actual, de 0 a 1. */
  local: number;
}

/** Interpolación lineal por tramos, como `useTransform` de Motion. */
function interpolar(p: number, entrada: number[], salida: number[]): number {
  if (p <= entrada[0]!) return salida[0]!;
  for (let i = 1; i < entrada.length; i++) {
    if (p <= entrada[i]!) {
      const t = (p - entrada[i - 1]!) / (entrada[i]! - entrada[i - 1]! || 1);
      return salida[i - 1]! + (salida[i]! - salida[i - 1]!) * t;
    }
  }
  return salida[salida.length - 1]!;
}

export function estadoDePaso(p: number, total: number): EstadoDePaso {
  const pesos = Array.from({ length: total }, (_, i) => {
    const tramo = tramoDePaso(i, total);
    return interpolar(p, tramo, [0, 1, 1, i === total - 1 ? 1 : 0]);
  });
  let indice = 0;
  pesos.forEach((w, i) => {
    if (w > pesos[indice]! || (w === pesos[indice] && w > 0 && p >= i / total)) indice = i;
  });
  const local = Math.min(1, Math.max(0, p * total - indice));
  return { pesos, indice, local };
}
