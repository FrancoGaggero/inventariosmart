import type { ContenidoReporte } from '@inventariosmart/shared';
import { diasDeSemana } from '@inventariosmart/shared';

export interface CorreoArmado {
  asunto: string;
  html: string;
  texto: string;
}

const pesos = new Intl.NumberFormat('es-AR', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const fecha = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', timeZone: 'UTC' });

export function formatearMonto(monto: string | null): string {
  return monto === null ? '—' : `$ ${pesos.format(Number(monto))}`;
}

function pct(p: string | null): string {
  return p === null ? '—' : `${pesos.format(Number(p))} %`;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** "14 al 20 de sep." a partir de la semana ISO. */
export function etiquetaSemana(semana: string): string {
  const { lunes, domingo } = diasDeSemana(semana as `${number}-W${string}`);
  const l = new Date(`${lunes}T00:00:00Z`);
  const d = new Date(`${domingo}T00:00:00Z`);
  return `${fecha.format(l)} al ${fecha.format(d)}`;
}

function variacion(v: string | null): string {
  if (v === null) return 'sin semana anterior para comparar';
  const n = Number(v);
  if (n === 0) return 'igual que la semana anterior';
  return `${n > 0 ? '▲' : '▼'} ${pesos.format(Math.abs(n))} % ${n > 0 ? 'más' : 'menos'} que la semana anterior`;
}

const TD = 'style="padding:6px 10px;border-bottom:1px solid #e2e8f0"';
const TDR = 'style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right"';

/** Correo del reporte semanal (design D5): números, estrellas, oportunidades, alertas y enlace. */
export function armarSemanal(
  nombreComercio: string,
  c: ContenidoReporte,
  urlWeb: string,
  reporteId: string,
): CorreoArmado {
  const rango = etiquetaSemana(c.semana);
  const asunto = `Tu semana en ${nombreComercio} · ${rango}`;
  const enlace = `${urlWeb.replace(/\/$/, '')}/reportes/${reporteId}`;
  const r = c.resumen;
  const o = c.oportunidades;
  const sinOportunidades =
    o.comprarMasBarato.items.length +
      o.capitalInmovilizado.items.length +
      o.margenBajo.items.length ===
    0;
  const netoTexto =
    r.margenNeto === null
      ? 'no calculable'
      : `${formatearMonto(r.margenNeto)} (${pct(r.margenNetoPct)})`;

  const estrellasHtml =
    c.estrellas.length === 0
      ? '<p style="color:#475569">Sin ventas esta semana.</p>'
      : `<ol style="padding-left:20px;margin:0">${c.estrellas
          .map(
            (e) =>
              `<li style="margin:4px 0">${escapar(e.producto.nombre)} <span style="color:#475569">· ${e.unidadesVendidas} vendidas · ${pct(e.margenBrutoPct)} de margen · <b>${formatearMonto(e.margenBrutoSemana)}</b></span></li>`,
          )
          .join('')}</ol>`;

  const bloque = (titulo: string, total: string, filas: string[]) =>
    filas.length === 0
      ? ''
      : `<h3 style="margin:16px 0 6px;font-size:15px">${titulo} <span style="color:#475569;font-weight:normal">· ${formatearMonto(total)}</span></h3><ul style="padding-left:20px;margin:0">${filas.map((f) => `<li style="margin:3px 0">${f}</li>`).join('')}</ul>`;

  const oportunidadesHtml = sinOportunidades
    ? '<p style="color:#475569">Sin oportunidades esta semana: comprás bien, la mercadería rota y el margen acompaña.</p>'
    : bloque(
        'Comprar más barato',
        o.comprarMasBarato.total,
        o.comprarMasBarato.items.map(
          (i) =>
            `${escapar(i.producto.nombre)}: ${escapar(i.proveedorSugerido)} a ${formatearMonto(i.costoSugerido)} vs. ${formatearMonto(i.costoActual)} · ahorro <b>${formatearMonto(i.ahorroEstimado)}</b>`,
        ),
      ) +
      bloque(
        'Capital inmovilizado',
        o.capitalInmovilizado.total,
        o.capitalInmovilizado.items.map(
          (i) =>
            `${escapar(i.producto.nombre)}: ${i.stock} en stock sin ventas en 30 días · <b>${formatearMonto(i.monto)}</b>`,
        ),
      ) +
      bloque(
        'Margen bajo',
        o.margenBajo.total,
        o.margenBajo.items.map(
          (i) =>
            `${escapar(i.producto.nombre)}: ${pct(i.margenBrutoPct)} de margen · vendido <b>${formatearMonto(i.monto)}</b>`,
        ),
      );

  const alertasHtml =
    c.alertasCriticas.length === 0
      ? ''
      : `<h2 style="margin:20px 0 8px;font-size:17px">Reposición urgente</h2><ul style="padding-left:20px;margin:0">${c.alertasCriticas
          .map(
            (a) =>
              `<li style="margin:3px 0">${escapar(a.producto.nombre)}: quedan ${a.stock}${a.diasCobertura === null ? '' : ` (${a.diasCobertura} días)`} · pedir ${a.cantidadSugerida}</li>`,
          )
          .join(
            '',
          )}</ul><p style="margin:8px 0"><a href="${escapar(`${urlWeb.replace(/\/$/, '')}/alertas`)}" style="color:#2563eb">Ver alertas</a></p>`;

  const html = `<!doctype html>
<html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:640px;margin:0 auto;padding:16px">
<h2 style="margin:0 0 4px">Tu semana en ${escapar(nombreComercio)}</h2>
<p style="margin:0 0 16px;color:#475569">${rango} · ${variacion(c.semanaAnterior.variacionVentasPct)}</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">
<tr><td ${TD}>Ventas netas</td><td ${TDR}><b>${formatearMonto(r.ventasNetas)}</b></td></tr>
<tr><td ${TD}>Unidades vendidas</td><td ${TDR}>${r.unidadesVendidas}</td></tr>
<tr><td ${TD}>Margen bruto</td><td ${TDR}><b>${formatearMonto(r.margenBruto)}</b> (${pct(r.margenBrutoPct)})</td></tr>
<tr><td ${TD}>Margen neto</td><td ${TDR}>${netoTexto}</td></tr>
</table>
<h2 style="margin:20px 0 8px;font-size:17px">Productos estrella</h2>
${estrellasHtml}
<h2 style="margin:20px 0 8px;font-size:17px">Oportunidades de ahorro</h2>
${oportunidadesHtml}
${alertasHtml}
<p style="margin:24px 0"><a href="${escapar(enlace)}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ver el reporte</a></p>
<p style="color:#94a3b8;font-size:12px">Ventas netas de IVA y costos vigentes (RN-01); margen neto con el gasto por unidad del mes (RN-02). Podés desactivar este correo desde Comercio.</p>
</body></html>`;

  const texto = [
    `Tu semana en ${nombreComercio} · ${rango}`,
    variacion(c.semanaAnterior.variacionVentasPct),
    '',
    `Ventas netas: ${formatearMonto(r.ventasNetas)} · ${r.unidadesVendidas} unidades`,
    `Margen bruto: ${formatearMonto(r.margenBruto)} (${pct(r.margenBrutoPct)})`,
    `Margen neto: ${netoTexto}`,
    '',
    'Productos estrella:',
    ...(c.estrellas.length === 0
      ? ['- Sin ventas esta semana.']
      : c.estrellas.map(
          (e) =>
            `- ${e.producto.nombre}: ${e.unidadesVendidas} vendidas, ${pct(e.margenBrutoPct)} de margen, ${formatearMonto(e.margenBrutoSemana)}`,
        )),
    '',
    'Oportunidades de ahorro:',
    ...(sinOportunidades
      ? ['- Sin oportunidades esta semana: comprás bien, la mercadería rota y el margen acompaña.']
      : [
          ...o.comprarMasBarato.items.map(
            (i) =>
              `- Comprar más barato · ${i.producto.nombre}: ${i.proveedorSugerido} a ${formatearMonto(i.costoSugerido)} vs. ${formatearMonto(i.costoActual)}, ahorro ${formatearMonto(i.ahorroEstimado)}`,
          ),
          ...o.capitalInmovilizado.items.map(
            (i) =>
              `- Capital inmovilizado · ${i.producto.nombre}: ${i.stock} en stock sin ventas en 30 días, ${formatearMonto(i.monto)}`,
          ),
          ...o.margenBajo.items.map(
            (i) =>
              `- Margen bajo · ${i.producto.nombre}: ${pct(i.margenBrutoPct)} de margen, vendido ${formatearMonto(i.monto)}`,
          ),
        ]),
    ...(c.alertasCriticas.length === 0
      ? []
      : [
          '',
          'Reposición urgente:',
          ...c.alertasCriticas.map(
            (a) => `- ${a.producto.nombre}: quedan ${a.stock}, pedir ${a.cantidadSugerida}`,
          ),
        ]),
    '',
    `Ver el reporte: ${enlace}`,
  ].join('\n');

  return { asunto, html, texto };
}
