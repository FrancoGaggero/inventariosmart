import {
  PESOS_PUNTAJE,
  type ComparacionProducto,
  type ProveedorComparado,
  type TotalesComparador,
} from '@inventariosmart/shared';

// Textos y formatos del comparador de proveedores (HU-12): funciones puras, sin red ni sesión.

const entero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });
const moneda = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2 });

const insumos = (n: number) => (n === 1 ? '1 insumo' : `${entero.format(n)} insumos`);

/** "14400.00" → "$ 14.400": el ahorro es una estimación, va sin centavos. */
export function formatearMonto(monto: string | number): string {
  return `$ ${entero.format(Number(monto))}`;
}

/** "2100.00" → "$ 2.100,00" */
export function formatearCosto(costo: string): string {
  return `$ ${moneda.format(Number(costo))}`;
}

/** Ahorro mensual estimado; sin dato (sin ventas, sin principal o sin diferencia a favor) "—". */
export function formatearAhorro(ahorro: string | null): string {
  return ahorro === null ? '—' : `${formatearMonto(ahorro)} por mes`;
}

/** "97.14" → "97,1" */
export function formatearPuntaje(puntaje: string): string {
  return decimal.format(Number(puntaje));
}

/** Contra el costo más bajo: "0.00" → "El más barato"; "5.00" → "5 % más caro". */
export function formatearDiferencia(diferenciaPct: string): string {
  const n = Number(diferenciaPct);
  return n <= 0 ? 'El más barato' : `${decimal.format(n)} % más caro`;
}

export function formatearPlazo(dias: number): string {
  if (dias === 0) return 'Entrega en el día';
  return dias === 1 ? 'Entrega en 1 día' : `Entrega en ${dias} días`;
}

/** Totales del comparador en una frase (CP-12.6). */
export function fraseTotales(t: TotalesComparador): string {
  if (t.comparables === 0) return 'Todavía no hay insumos con dos o más proveedores.';
  if (t.conCambio === 0) {
    return t.comparables === 1
      ? 'Ya le comprás al proveedor recomendado en tu único insumo con más de un proveedor.'
      : `Ya le comprás al proveedor recomendado en tus ${insumos(t.comparables)} con más de un proveedor.`;
  }
  const base = `Conviene cambiar de proveedor en ${entero.format(t.conCambio)} de ${insumos(t.comparables)}`;
  return Number(t.ahorroEstimado) > 0
    ? `${base}: ahorrarías unos ${formatearMonto(t.ahorroEstimado)} por mes.`
    : `${base}.`;
}

/** Qué conviene hacer con un insumo, en una frase. */
export function fraseRecomendacion(c: ComparacionProducto): string {
  if (!c.recomendado) return 'Ningún proveedor activo tiene un costo cargado para este insumo.';
  if (!c.comparable) {
    return `Sólo ${c.recomendado.nombre} tiene un costo cargado: hace falta otro proveedor para comparar.`;
  }
  if (!c.cambiaProveedor) {
    return `${c.recomendado.nombre} es el recomendado y ya es tu proveedor principal.`;
  }
  if (!c.principal) {
    return `Te conviene ${c.recomendado.nombre}. Este insumo no tiene un proveedor principal que se pueda comparar.`;
  }
  return c.ahorroEstimado === null
    ? `Te conviene ${c.recomendado.nombre} en lugar de ${c.principal.nombre}, por el puntaje.`
    : `Te conviene ${c.recomendado.nombre} en lugar de ${c.principal.nombre}: ahorrarías unos ${formatearMonto(c.ahorroEstimado)} por mes.`;
}

export interface ComponentePuntaje {
  clave: keyof typeof PESOS_PUNTAJE;
  etiqueta: string;
  /** Peso en el puntaje, en % (60, 25 y 15). */
  peso: number;
  /** Componente de 0 a 100. */
  valor: number;
  /** Puntos que suma al puntaje total. */
  aporte: number;
}

/** Los tres componentes del puntaje de un proveedor con lo que aporta cada uno (RN-13). */
export function componentesPuntaje(p: ProveedorComparado): ComponentePuntaje[] {
  const fila = (
    clave: ComponentePuntaje['clave'],
    etiqueta: string,
    valor: string,
  ): ComponentePuntaje => ({
    clave,
    etiqueta,
    peso: Math.round(PESOS_PUNTAJE[clave] * 100),
    valor: Number(valor),
    aporte: Math.round(PESOS_PUNTAJE[clave] * Number(valor) * 10) / 10,
  });
  return [
    fila('precio', 'Precio', p.puntajePrecio),
    fila('plazo', 'Plazo', p.puntajePlazo),
    fila('confiabilidad', 'Confiabilidad', p.puntajeConfiabilidad),
  ];
}

/** Texto del diálogo de "Usar como principal": avisa que cambia el costo de reposición (RN-08). */
export function fraseConfirmarPrincipal(producto: string, proveedor: string, costo: string) {
  return `${proveedor} pasa a ser el proveedor principal de ${producto} y el costo de reposición del producto pasa a ${formatearCosto(costo)}.`;
}
