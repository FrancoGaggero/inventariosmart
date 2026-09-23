import type { SeveridadAlerta } from '@inventariosmart/shared';
import { ETIQUETA_SEVERIDAD } from '@inventariosmart/shared';

/** Datos mínimos de una alerta para el correo de resumen (design D5). */
export interface AlertaParaCorreo {
  codigo: string;
  nombre: string;
  stock: number;
  diasCobertura: number | null;
  cantidadSugerida: number;
  severidad: SeveridadAlerta;
}

export interface CorreoArmado {
  asunto: string;
  html: string;
  texto: string;
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cobertura(dias: number | null): string {
  if (dias === null) return 'sin ventas recientes';
  if (dias === 0) return 'se agota hoy';
  return dias === 1 ? '1 día' : `${dias} días`;
}

/** Resumen de alertas nuevas para los dueños del comercio (HU-06 criterio 3). */
export function armarResumen(
  nombreComercio: string,
  alertas: AlertaParaCorreo[],
  urlWeb: string,
): CorreoArmado {
  const n = alertas.length;
  const asunto =
    n === 1
      ? `InventarioSmart · 1 producto para reponer en ${nombreComercio}`
      : `InventarioSmart · ${n} productos para reponer en ${nombreComercio}`;
  const enlace = `${urlWeb.replace(/\/$/, '')}/alertas`;

  const filasHtml = alertas
    .map(
      (a) => `<tr>
  <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${escapar(a.codigo)} · ${escapar(a.nombre)}</td>
  <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${a.stock}</td>
  <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${cobertura(a.diasCobertura)}</td>
  <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right">${a.cantidadSugerida}</td>
  <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0">${ETIQUETA_SEVERIDAD[a.severidad]}</td>
</tr>`,
    )
    .join('\n');

  const html = `<!doctype html>
<html lang="es"><body style="font-family:Arial,Helvetica,sans-serif;color:#0f172a;max-width:640px;margin:0 auto;padding:16px">
<h2 style="margin:0 0 8px">Productos para reponer</h2>
<p style="margin:0 0 16px;color:#475569">${escapar(nombreComercio)}: ${n === 1 ? 'un producto va' : `${n} productos van`} a quedarse sin stock antes de que llegue la reposición.</p>
<table style="border-collapse:collapse;width:100%;font-size:14px">
<thead><tr style="text-align:left;color:#475569">
  <th style="padding:6px 10px">Producto</th><th style="padding:6px 10px;text-align:right">Stock</th><th style="padding:6px 10px">Cobertura</th><th style="padding:6px 10px;text-align:right">Sugerido</th><th style="padding:6px 10px">Estado</th>
</tr></thead>
<tbody>
${filasHtml}
</tbody></table>
<p style="margin:20px 0"><a href="${escapar(enlace)}" style="background:#2563eb;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Ver alertas</a></p>
<p style="color:#94a3b8;font-size:12px">Calculado con las ventas de los últimos 30 días y el lead time de cada proveedor. Podés ajustar la anticipación por producto desde Inventario.</p>
</body></html>`;

  const texto = [
    `Productos para reponer en ${nombreComercio}:`,
    ...alertas.map(
      (a) =>
        `- ${a.codigo} · ${a.nombre}: stock ${a.stock}, cobertura ${cobertura(a.diasCobertura)}, sugerido ${a.cantidadSugerida} (${ETIQUETA_SEVERIDAD[a.severidad]})`,
    ),
    '',
    `Ver alertas: ${enlace}`,
  ].join('\n');

  return { asunto, html, texto };
}
