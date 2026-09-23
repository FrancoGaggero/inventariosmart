import { ETIQUETA_MOTIVO_RESUMEN, mesActual, type Mes } from '@inventariosmart/shared';
import { AlertTriangle, PackageX, TrendingUp } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import { useDashboard } from '@/lib/dashboard';
import { formatearMes } from '@/lib/gastos';
import { formatearPesos } from '@/lib/productos';
import { claseSigno, formatearPct } from '@/lib/rentabilidad';
import { Aviso } from '@/ui/Aviso';
import { SelectorMes } from '@/ui/SelectorMes';

const entero = new Intl.NumberFormat('es-AR');

/** Frase de cabecera en lenguaje claro (HU-04 criterio 4). */
function fraseDelMes(d: {
  ventas: { unidadesVendidas: number; ventasNetas: string };
  mesAnterior: { variacionVentasPct: string | null };
}): string {
  const { unidadesVendidas, ventasNetas } = d.ventas;
  if (unidadesVendidas === 0) return 'Este mes todavía no registraste ventas.';
  const base = `Este mes vendiste ${entero.format(unidadesVendidas)} ${
    unidadesVendidas === 1 ? 'unidad' : 'unidades'
  } por ${formatearPesos(ventasNetas)} netos`;
  const v = d.mesAnterior.variacionVentasPct;
  if (v === null) return `${base}.`;
  const n = Number(v);
  if (n === 0) return `${base}, igual que el mes pasado.`;
  return `${base}, un ${formatearPct(String(Math.abs(n)))} ${n > 0 ? 'más' : 'menos'} que el mes pasado.`;
}

/** Panel financiero del mes para DUENIO y CONTADOR (HU-04). */
export function Dashboard({ puedeOperar }: { puedeOperar: boolean }) {
  const [periodo, setPeriodo] = useState<Mes>(mesActual());
  const panel = useDashboard(periodo);
  const d = panel.data;

  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold capitalize">{formatearMes(periodo)}</h2>
          <p className="text-t2 text-sm">
            {d ? fraseDelMes(d) : panel.isError ? mensajeDe(panel.error) : 'Cargando el panel…'}
          </p>
        </div>
        <SelectorMes valor={periodo} onChange={setPeriodo} />
      </div>

      <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
        <div className="card p-4">
          <dt className="text-t2">Stock valorizado</dt>
          <dd className="text-xl font-extrabold tabular-nums">
            {d ? formatearPesos(d.stock.valorizacion) : '…'}
          </dd>
          <dd className="text-xs text-t3 mt-1">
            {d
              ? `${entero.format(d.stock.unidades)} unidades en ${d.stock.productosActivos} productos`
              : ''}
          </dd>
        </div>
        <div className="card p-4">
          <dt className="text-t2">Ventas netas del mes</dt>
          <dd className="text-xl font-extrabold tabular-nums">
            {d ? formatearPesos(d.ventas.ventasNetas) : '…'}
          </dd>
          <dd className="text-xs text-t3 mt-1">
            {d
              ? d.mesAnterior.variacionVentasPct === null
                ? `Mes anterior: ${formatearPesos(d.mesAnterior.ventasNetas)}`
                : `${Number(d.mesAnterior.variacionVentasPct) >= 0 ? '▲' : '▼'} ${formatearPct(d.mesAnterior.variacionVentasPct)} vs. mes anterior`
              : ''}
          </dd>
        </div>
        <div className="card p-4">
          <dt className="text-t2">Margen bruto</dt>
          <dd
            className={`text-xl font-extrabold tabular-nums ${d ? claseSigno(d.ventas.margenBruto) : ''}`}
          >
            {d ? formatearPesos(d.ventas.margenBruto) : '…'}
          </dd>
          <dd className="text-xs text-t3 mt-1">
            {d ? `${formatearPct(d.ventas.margenBrutoPct)} sobre ventas` : ''}
          </dd>
        </div>
        <div className="card p-4">
          <dt className="text-t2">Margen neto</dt>
          <dd
            className={`text-xl font-extrabold tabular-nums ${d ? claseSigno(d.ventas.margenNeto) : ''}`}
          >
            {d ? (d.ventas.margenNeto === null ? '—' : formatearPesos(d.ventas.margenNeto)) : '…'}
          </dd>
          <dd className="text-xs text-t3 mt-1">
            {d
              ? d.ventas.margenNeto === null
                ? 'No calculable'
                : `${formatearPct(d.ventas.margenNetoPct)} sobre ventas · gastos ${formatearPesos(d.ventas.gastos)}`
              : ''}
          </dd>
        </div>
      </dl>

      {d?.ventas.motivo && (
        <Aviso tono="warn">
          {ETIQUETA_MOTIVO_RESUMEN[d.ventas.motivo]}{' '}
          {d.ventas.motivo === 'SIN_GASTOS' && puedeOperar && (
            <Link to={`/gastos/nuevo?periodo=${periodo}`} className="font-semibold underline">
              Cargar gastos
            </Link>
          )}
          {d.ventas.motivo === 'SIN_VENTAS' && puedeOperar && (
            <Link to="/movimientos/nuevo" className="font-semibold underline">
              Registrar una venta
            </Link>
          )}
        </Aviso>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <article className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-ok" aria-hidden />
              Productos más rentables del mes
            </h3>
            <Link to="/rentabilidad" className="text-xs font-semibold text-brand-3 hover:underline">
              Ver todos
            </Link>
          </div>
          {d && d.topRentables.length === 0 ? (
            <p className="text-sm text-t2">
              Sin ventas en el mes.{' '}
              {puedeOperar && (
                <Link to="/movimientos/nuevo" className="text-brand-3 font-semibold">
                  Registrá la primera
                </Link>
              )}
            </p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {(d?.topRentables ?? []).map((p, i) => (
                  <tr key={p.producto.id} className="border-t border-white/6 first:border-0">
                    <td className="py-2 pr-2 text-t3 tabular-nums w-6">{i + 1}</td>
                    <td className="py-2">
                      <div className="font-semibold">{p.producto.nombre}</div>
                      <div className="text-xs text-t2">
                        {p.unidadesVendidas} vendidas · {formatearPct(p.margenBrutoPct)} de margen
                      </div>
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums font-semibold ${claseSigno(p.margenBrutoMes)}`}
                    >
                      {formatearPesos(p.margenBrutoMes)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warn" aria-hidden />
              Alertas activas
            </h3>
            {puedeOperar && (
              <Link to="/productos" className="text-xs font-semibold text-brand-3 hover:underline">
                Ver inventario
              </Link>
            )}
          </div>
          {d &&
          d.alertas.sinStock.total === 0 &&
          d.alertas.stockBajo.total === 0 &&
          !d.alertas.faltanGastos ? (
            <p className="text-sm text-ok">
              Todo en orden: no hay productos sin stock ni por debajo del mínimo.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d?.alertas.sinStock.items.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <PackageX className="w-4 h-4 text-crit" aria-hidden />
                    <span>
                      <b>{a.nombre}</b> <span className="text-t2">sin stock</span>
                    </span>
                  </span>
                  {puedeOperar && (
                    <Link
                      to={`/movimientos/nuevo?productoId=${a.id}&tipo=INGRESO`}
                      className="text-xs font-semibold text-brand-3 hover:underline whitespace-nowrap"
                    >
                      Ingresar
                    </Link>
                  )}
                </li>
              ))}
              {d?.alertas.stockBajo.items.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3">
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-warn" aria-hidden />
                    <span>
                      <b>{a.nombre}</b>{' '}
                      <span className="text-t2">
                        quedan {a.stockActual}, mínimo {a.stockSeguridad}
                      </span>
                    </span>
                  </span>
                  {puedeOperar && (
                    <Link
                      to={`/movimientos/nuevo?productoId=${a.id}&tipo=INGRESO`}
                      className="text-xs font-semibold text-brand-3 hover:underline whitespace-nowrap"
                    >
                      Ingresar
                    </Link>
                  )}
                </li>
              ))}
              {d &&
                (d.alertas.sinStock.total > d.alertas.sinStock.items.length ||
                  d.alertas.stockBajo.total > d.alertas.stockBajo.items.length) && (
                  <li className="text-xs text-t3">
                    {d.alertas.sinStock.total} sin stock y {d.alertas.stockBajo.total} con stock
                    bajo en total.
                  </li>
                )}
              {d?.alertas.faltanGastos && (
                <li className="text-t2">
                  Faltan los gastos del mes: sin ellos no se calcula el margen neto.
                </li>
              )}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
