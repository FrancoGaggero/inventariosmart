import {
  ETIQUETA_REDONDEO,
  type CriterioRemarcacion,
  type ItemRemarcacion,
  type Mes,
  type ParametrosRemarcacion,
  type RemarcacionPreview,
  type Redondeo,
  type ResumenRemarcacion,
} from '@inventariosmart/shared';

// Textos y reglas de pantalla de la remarcación (HU-17): funciones puras, sin red ni sesión.

const numero = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 2 });
const pct = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** Cómo se calculó una remarcación, en lenguaje claro: "Subió 15 %, redondeado a la decena". */
export function fraseCriterio(criterio: CriterioRemarcacion, p: ParametrosRemarcacion): string {
  const base: Record<CriterioRemarcacion, string> = {
    INFLACION: 'Alcanzó la inflación',
    MARGEN: 'Sostuvo el margen',
    PORCENTAJE:
      `Subió ${p.porcentaje === undefined ? '' : `${numero.format(p.porcentaje)} %`}`.trim(),
    MARGEN_OBJETIVO:
      `Margen objetivo ${p.margen === undefined ? '' : `${numero.format(p.margen)} %`}`.trim(),
  };
  const redondeo =
    p.redondeo && p.redondeo !== 'NINGUNO'
      ? `, redondeado ${ETIQUETA_REDONDEO[p.redondeo].toLowerCase()}`
      : '';
  return `${base[criterio]}${redondeo}`;
}

const plural = (n: number, uno: string, varios: string) =>
  n === 1 ? `1 ${uno}` : `${n} ${varios}`;

/** Resumen de la vista previa: "12 productos suben, 3 quedan igual y 1 no se puede calcular". */
export function fraseResumen(r: ResumenRemarcacion): string {
  const partes = [
    r.suben > 0 ? `${plural(r.suben, 'producto sube', 'productos suben')}` : null,
    r.bajan > 0 ? `${plural(r.bajan, 'baja', 'bajan')}` : null,
    r.sinCambio > 0 ? `${plural(r.sinCambio, 'queda igual', 'quedan igual')}` : null,
    r.sinDatos > 0
      ? `${plural(r.sinDatos, 'no se puede calcular', 'no se pueden calcular')}`
      : null,
  ].filter((p): p is string => p !== null);
  if (partes.length === 0) return 'No hay productos para remarcar con este criterio.';
  if (r.suben === 0 && r.bajan === 0) {
    return `Ningún precio cambia: ${partes.join(' y ')}.`;
  }
  const ultima = partes.pop()!;
  return partes.length > 0 ? `${partes.join(', ')} y ${ultima}.` : `${ultima}.`;
}

/** "9.09" → "+9,1 %"; "-7.69" → "−7,7 %"; "0.00" → "0 %". */
export function formatearCambio(variacion: string | null): string {
  if (variacion === null) return '—';
  const n = Number(variacion);
  const texto = `${pct.format(Math.abs(n))} %`;
  if (texto === '0 %') return texto;
  return `${n > 0 ? '+' : '−'}${texto}`;
}

export interface FormularioRemarcacion {
  criterio: CriterioRemarcacion;
  porcentaje: string;
  margen: string;
  redondeo: Redondeo;
  permitirBajas: boolean;
  estado: 'ATRASADO' | 'ALINEADO' | 'ADELANTADO' | null;
  desde: Mes | null;
  hasta: Mes | null;
}

const aNumero = (texto: string): number | null => {
  const n = Number(texto.trim().replace(',', '.'));
  return texto.trim() !== '' && Number.isFinite(n) ? n : null;
};

/** Cuerpo de la vista previa a partir del formulario, o el error del campo que falta. */
export function armarPedido(
  f: FormularioRemarcacion,
): { pedido: RemarcacionPreview; error: null } | { pedido: null; error: string } {
  const comunes = {
    redondeo: f.redondeo,
    permitirBajas: f.permitirBajas,
    ...(f.estado ? { estado: f.estado } : {}),
    ...(f.desde ? { desde: f.desde } : {}),
    ...(f.hasta ? { hasta: f.hasta } : {}),
  };
  if (f.criterio === 'PORCENTAJE') {
    const porcentaje = aNumero(f.porcentaje);
    if (porcentaje === null || porcentaje <= 0 || porcentaje > 500) {
      return { pedido: null, error: 'Indicá un porcentaje mayor a 0 y hasta 500.' };
    }
    return { pedido: { criterio: 'PORCENTAJE', porcentaje, ...comunes }, error: null };
  }
  if (f.criterio === 'MARGEN_OBJETIVO') {
    const margen = aNumero(f.margen);
    if (margen === null || margen <= 0 || margen > 95) {
      return { pedido: null, error: 'Indicá un margen mayor a 0 y hasta 95 %.' };
    }
    return { pedido: { criterio: 'MARGEN_OBJETIVO', margen, ...comunes }, error: null };
  }
  return { pedido: { criterio: f.criterio, ...comunes }, error: null };
}

export interface FilaAplicable {
  productoId: string;
  precioActual: string;
  precioNuevo: string;
}

/**
 * Precio final de una fila: el que ajustó el dueño o el calculado. Devuelve null si la fila no
 * se aplica (sin precio, igual al actual o inválida) y el error si lo que escribió no sirve.
 */
export function precioFinal(
  item: Pick<ItemRemarcacion, 'precioActual' | 'precioNuevo'>,
  ajuste: string | undefined,
): { precio: string | null; error: string | null } {
  if (ajuste === undefined || ajuste.trim() === '') {
    const precio =
      item.precioNuevo !== null && Number(item.precioNuevo) !== Number(item.precioActual)
        ? item.precioNuevo
        : null;
    return { precio, error: null };
  }
  const texto = ajuste.trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(texto) || !(Number(texto) > 0)) {
    return { precio: null, error: 'Ingresá un precio mayor a 0, con hasta 2 decimales.' };
  }
  if (Number(texto) === Number(item.precioActual)) return { precio: null, error: null };
  return { precio: Number(texto).toFixed(2), error: null };
}

/** Filas que se van a aplicar: las elegidas, con precio válido y distinto del actual. */
export function filasAplicables(
  items: ItemRemarcacion[],
  quitados: ReadonlySet<string>,
  ajustes: Readonly<Record<string, string>>,
): FilaAplicable[] {
  const filas: FilaAplicable[] = [];
  for (const i of items) {
    if (quitados.has(i.producto.id)) continue;
    const { precio } = precioFinal(i, ajustes[i.producto.id]);
    if (precio === null) continue;
    filas.push({ productoId: i.producto.id, precioActual: i.precioActual, precioNuevo: precio });
  }
  return filas;
}

/** Resultado de deshacer: cuántos volvieron y cuáles no se tocaron. */
export function fraseReversion(revertidos: number, omitidos: string[]): string {
  const volvieron =
    revertidos === 1
      ? '1 producto volvió a su precio anterior.'
      : `${revertidos} productos volvieron a su precio anterior.`;
  if (omitidos.length === 0) return volvieron;
  const nombres = `${omitidos.slice(0, 5).join(', ')}${omitidos.length > 5 ? '…' : ''}`;
  const sinTocar =
    omitidos.length === 1
      ? `No se tocó 1 producto porque cambió después: ${nombres}.`
      : `No se tocaron ${omitidos.length} productos porque cambiaron después: ${nombres}.`;
  return `${volvieron} ${sinTocar}`;
}

/** Pie de un lote deshecho: "1 revertido y 2 sin tocar". */
export function fraseDeshecho(revertidos: number, omitidos: number): string {
  const r = revertidos === 1 ? '1 revertido' : `${revertidos} revertidos`;
  return omitidos > 0 ? `${r} y ${omitidos} sin tocar` : r;
}
