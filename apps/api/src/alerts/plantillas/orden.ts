/** Datos de una orden para redactar el pedido al proveedor (HU-07 criterio 2, design D4). */
export interface OrdenParaTexto {
  numero: string;
  comercio: { nombre: string };
  proveedor: { nombre: string; contacto: string | null; leadTimeDias: number };
  items: { codigo: string; nombre: string; cantidad: number; costoUnitarioNeto: string | null }[];
  totalNeto: string;
  duenio: { nombre: string | null; email: string };
}

export interface TextoOrden {
  asunto: string;
  texto: string;
}

const pesos = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$ 2.000,00" a partir de un decimal como string. */
export function formatearMonto(monto: string): string {
  return `$ ${pesos.format(Number(monto))}`;
}

function unidades(n: number): string {
  return n === 1 ? '1 unidad' : `${n} unidades`;
}

function plazo(dias: number): string {
  if (dias === 0) return 'entrega inmediata';
  return dias === 1 ? '1 día' : `${dias} días`;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Redacción determinista, sin IA: saludo con contacto, ítems con código, cantidad y costo,
 * total neto, plazo esperado según el lead time y firma del comercio y del dueño.
 */
export function armarOrden(o: OrdenParaTexto): TextoOrden {
  const asunto = `Orden de compra ${o.numero} · ${o.comercio.nombre}`;
  const saludo = o.proveedor.contacto
    ? `Hola ${o.proveedor.contacto} (${o.proveedor.nombre}):`
    : `Hola, equipo de ${o.proveedor.nombre}:`;
  const lineas = o.items.map((i) => {
    const base = `- ${i.codigo} · ${i.nombre}: ${unidades(i.cantidad)}`;
    if (i.costoUnitarioNeto === null) return `${base}, precio a confirmar`;
    const subtotal = ((Math.round(Number(i.costoUnitarioNeto) * 100) * i.cantidad) / 100).toFixed(
      2,
    );
    return `${base} a ${formatearMonto(i.costoUnitarioNeto)} c/u (neto) = ${formatearMonto(subtotal)}`;
  });
  const conCosto = o.items.some((i) => i.costoUnitarioNeto !== null);
  const firma = o.duenio.nombre ? `${o.duenio.nombre} · ${o.comercio.nombre}` : o.comercio.nombre;
  const texto = [
    saludo,
    '',
    `Les pedimos la siguiente reposición para ${o.comercio.nombre}:`,
    '',
    ...lineas,
    '',
    conCosto
      ? `Total neto estimado (sin IVA): ${formatearMonto(o.totalNeto)}`
      : 'Total a confirmar según su lista vigente.',
    `Plazo de entrega esperado: ${plazo(o.proveedor.leadTimeDias)}, según lo acordado.`,
    '',
    'Por favor confirmen disponibilidad y fecha de entrega respondiendo a este correo.',
    '',
    'Saludos,',
    firma,
    o.duenio.email,
    '',
    `${o.numero} · generada con InventarioSmart`,
  ].join('\n');
  return { asunto, texto };
}

/** HTML mínimo del correo: el texto tal cual, con saltos de línea respetados. */
export function htmlDeOrden(texto: string): string {
  return `<!doctype html>
<html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:640px;margin:0 auto;padding:16px">
<p style="white-space:pre-wrap;font-size:14px;line-height:1.5;margin:0">${escapar(texto)}</p>
</body></html>`;
}
