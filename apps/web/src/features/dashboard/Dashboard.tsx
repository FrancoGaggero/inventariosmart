import { ETIQUETA_MOTIVO_RESUMEN, mesActual, type Mes } from '@inventariosmart/shared';
import {
  AlertTriangle,
  BellRing,
  Boxes,
  type LucideIcon,
  PackageX,
  Percent,
  ShoppingBag,
  TrendingUp,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatearCobertura } from '@/lib/alertas';
import { mensajeDe } from '@/lib/api';
import { useDashboard } from '@/lib/dashboard';
import { formatearMes } from '@/lib/gastos';
import { formatearPesos } from '@/lib/productos';
import { claseSigno, formatearPct } from '@/lib/rentabilidad';
import { Anillo } from '@/ui/Anillo';
import { Aviso } from '@/ui/Aviso';
import { Barra } from '@/ui/Barra';
import { Entrada } from '@/ui/Entrada';
import { SelectorMes } from '@/ui/SelectorMes';
import { Skeleton } from '@/ui/Skeleton';
import { useContador } from '@/ui/useContador';

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

/** Monto que sube hasta su valor (design D4): el `aria-label` lleva el valor final. */
function MontoAnimado({ valor, className = '' }: { valor: string | null; className?: string }) {
  const animado = useContador(valor === null ? null : Number(valor));
  return (
    <span
      className={`tabular-nums ${className}`}
      aria-label={valor === null ? 'No calculable' : formatearPesos(valor)}
      aria-live="off"
    >
      {animado === null ? '—' : formatearPesos(animado.toFixed(2))}
    </span>
  );
}

const TONO: Record<'brand' | 'ok' | 'violet' | 'warn', string> = {
  brand: 'bg-brand/15 text-brand-3',
  ok: 'bg-ok/15 text-ok',
  violet: 'bg-violet/15 text-violet',
  warn: 'bg-warn/15 text-warn',
};

function Kpi({
  indice,
  titulo,
  Icono,
  tono,
  cargando,
  valor,
  claseValor = '',
  detalle,
  extra,
}: {
  indice: number;
  titulo: string;
  Icono: LucideIcon;
  tono: keyof typeof TONO;
  cargando: boolean;
  valor: string | null;
  claseValor?: string;
  detalle: string;
  extra?: React.ReactNode;
}) {
  return (
    <Entrada indice={indice} className="card card-hover p-4 flex gap-3 min-w-0 overflow-hidden">
      <span
        className={`w-10 h-10 rounded-xl grid place-items-center shrink-0 ${TONO[tono]}`}
        aria-hidden
      >
        <Icono className="w-5 h-5" />
      </span>
      <div className="min-w-0 flex-1">
        <dt className="text-t2 text-xs font-semibold uppercase tracking-wider">{titulo}</dt>
        {cargando ? (
          <>
            <Skeleton variante="numero" className="mt-1.5" />
            <Skeleton variante="linea" className="mt-2" />
          </>
        ) : (
          <>
            <dd
              className={`text-lg sm:text-xl font-extrabold leading-tight mt-0.5 whitespace-nowrap ${claseValor}`}
            >
              <MontoAnimado valor={valor} />
            </dd>
            <dd className="text-xs text-t3 mt-1 truncate">{detalle}</dd>
          </>
        )}
      </div>
      {!cargando && extra}
    </Entrada>
  );
}

/** Panel financiero del mes para DUENIO y CONTADOR (HU-04). */
export function Dashboard({ puedeOperar }: { puedeOperar: boolean }) {
  const [periodo, setPeriodo] = useState<Mes>(mesActual());
  const panel = useDashboard(periodo);
  const d = panel.data;
  const cargando = panel.isPending;

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
        <Kpi
          indice={0}
          titulo="Stock valorizado"
          Icono={Boxes}
          tono="brand"
          cargando={cargando}
          valor={d?.stock.valorizacion ?? null}
          detalle={
            d
              ? `${entero.format(d.stock.unidades)} unidades en ${d.stock.productosActivos} productos`
              : ''
          }
        />
        <Kpi
          indice={1}
          titulo="Ventas netas del mes"
          Icono={ShoppingBag}
          tono="violet"
          cargando={cargando}
          valor={d?.ventas.ventasNetas ?? null}
          detalle={
            d
              ? d.mesAnterior.variacionVentasPct === null
                ? `Mes anterior: ${formatearPesos(d.mesAnterior.ventasNetas)}`
                : `${Number(d.mesAnterior.variacionVentasPct) >= 0 ? '▲' : '▼'} ${formatearPct(d.mesAnterior.variacionVentasPct)} vs. mes anterior`
              : ''
          }
        />
        <Kpi
          indice={2}
          titulo="Margen bruto"
          Icono={TrendingUp}
          tono="ok"
          cargando={cargando}
          valor={d?.ventas.margenBruto ?? null}
          claseValor={d ? claseSigno(d.ventas.margenBruto) : ''}
          detalle={d ? `${formatearPct(d.ventas.margenBrutoPct)} sobre ventas` : ''}
          extra={
            d && (
              <Anillo
                valor={d.ventas.margenBrutoPct === null ? null : Number(d.ventas.margenBrutoPct)}
                etiqueta="Margen bruto sobre ventas"
                tamanio={56}
                grosor={6}
              />
            )
          }
        />
        <Kpi
          indice={3}
          titulo="Margen neto"
          Icono={Percent}
          tono="warn"
          cargando={cargando}
          valor={d?.ventas.margenNeto ?? null}
          claseValor={d ? claseSigno(d.ventas.margenNeto) : ''}
          detalle={
            d
              ? d.ventas.margenNeto === null
                ? 'No calculable'
                : `${formatearPct(d.ventas.margenNetoPct)} sobre ventas · gastos ${formatearPesos(d.ventas.gastos)}`
              : ''
          }
          extra={
            d && (
              <Anillo
                valor={d.ventas.margenNetoPct === null ? null : Number(d.ventas.margenNetoPct)}
                etiqueta="Margen neto sobre ventas"
                tamanio={56}
                grosor={6}
              />
            )
          }
        />
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
        <Entrada as="article" indice={4} className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-ok" aria-hidden />
              Productos más rentables del mes
            </h3>
            <Link to="/rentabilidad" className="text-xs font-semibold text-brand-3 hover:underline">
              Ver todos
            </Link>
          </div>
          {cargando ? (
            <div className="space-y-2">
              <Skeleton variante="fila" />
              <Skeleton variante="fila" />
              <Skeleton variante="fila" />
            </div>
          ) : d && d.topRentables.length === 0 ? (
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
                {(d?.topRentables ?? []).map((p, i) => {
                  const max = Number(d?.topRentables[0]?.margenBrutoMes ?? 0);
                  return (
                    <Entrada
                      as="tr"
                      indice={i}
                      key={p.producto.id}
                      className="border-t border-line first:border-0"
                    >
                      <td className="py-2 pr-2 text-t3 tabular-nums w-6">{i + 1}</td>
                      <td className="py-2">
                        <div className="font-semibold">{p.producto.nombre}</div>
                        <div className="text-xs text-t2">
                          {p.unidadesVendidas} vendidas · {formatearPct(p.margenBrutoPct)} de margen
                        </div>
                        <Barra
                          valor={Number(p.margenBrutoMes)}
                          maximo={max > 0 ? max : 1}
                          etiqueta={`Margen bruto de ${p.producto.nombre} respecto del primero`}
                          className="mt-1.5 max-w-48"
                        />
                      </td>
                      <td
                        className={`py-2 text-right tabular-nums font-semibold ${claseSigno(p.margenBrutoMes)}`}
                      >
                        {formatearPesos(p.margenBrutoMes)}
                      </td>
                    </Entrada>
                  );
                })}
              </tbody>
            </table>
          )}
        </Entrada>

        <Entrada as="article" indice={5} className="card p-5">
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
          {cargando ? (
            <div className="space-y-2">
              <Skeleton variante="fila" />
              <Skeleton variante="fila" />
            </div>
          ) : d &&
            d.alertas.sinStock.total === 0 &&
            d.alertas.stockBajo.total === 0 &&
            !d.alertas.faltanGastos ? (
            <p className="text-sm text-ok">
              Todo en orden: no hay productos sin stock ni por debajo del mínimo.
            </p>
          ) : (
            <ul className="space-y-2 text-sm">
              {d?.alertas.sinStock.items.map((a, i) => (
                <Entrada
                  as="li"
                  indice={i}
                  key={a.id}
                  className="flex items-center justify-between gap-3"
                >
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
                </Entrada>
              ))}
              {d?.alertas.stockBajo.items.map((a, i) => (
                <Entrada
                  as="li"
                  indice={(d.alertas.sinStock.items.length ?? 0) + i}
                  key={a.id}
                  className="flex items-center justify-between gap-3"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <AlertTriangle className="w-4 h-4 text-warn shrink-0" aria-hidden />
                    <span className="min-w-0">
                      <b>{a.nombre}</b>{' '}
                      <span className="text-t2">
                        quedan {a.stockActual}, mínimo {a.stockSeguridad}
                      </span>
                      <Barra
                        valor={a.stockActual}
                        maximo={Math.max(a.stockSeguridad * 2, 1)}
                        critico={0}
                        alerta={a.stockSeguridad}
                        etiqueta={`Stock de ${a.nombre} respecto del mínimo`}
                        className="mt-1 max-w-40"
                      />
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
                </Entrada>
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
        </Entrada>

        <Entrada as="article" indice={6} className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold flex items-center gap-2">
              <BellRing className="w-4 h-4 text-warn" aria-hidden />
              Reposición
            </h3>
            {d?.alertas.reposicion && (
              <Link to="/alertas" className="text-xs font-semibold text-brand-3 hover:underline">
                Ver alertas
              </Link>
            )}
          </div>
          {cargando ? (
            <div className="space-y-2">
              <Skeleton variante="fila" />
              <Skeleton variante="fila" />
            </div>
          ) : !d ? null : d.alertas.reposicion === null ? (
            <p className="text-sm text-t2">
              Alertas predictivas de reposición: disponibles en el plan PRO. Calculan cuándo reponer
              según tus ventas y el lead time de cada proveedor.
            </p>
          ) : d.alertas.reposicion.total === 0 ? (
            <p className="text-sm text-ok">
              Ningún producto se va a quedar sin stock antes de que llegue la reposición.
            </p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 text-sm">
              {d.alertas.reposicion.items.map((a, i) => (
                <Entrada
                  as="li"
                  indice={i}
                  key={a.id}
                  className="rounded-xl bg-fill p-3 flex flex-col gap-1.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-2 min-w-0">
                      <AlertTriangle
                        className={`w-4 h-4 shrink-0 ${a.severidad === 'CRITICA' ? 'text-crit' : 'text-warn'}`}
                        aria-hidden
                      />
                      <b className="truncate">{a.producto.nombre}</b>
                    </span>
                    {puedeOperar && (
                      <Link
                        to={`/movimientos/nuevo?productoId=${a.producto.id}&tipo=INGRESO`}
                        className="text-xs font-semibold text-brand-3 hover:underline whitespace-nowrap"
                      >
                        Ingresar
                      </Link>
                    )}
                  </div>
                  <span className="text-xs text-t2">
                    {formatearCobertura(a.diasCobertura)} de stock · pedir {a.cantidadSugerida}
                  </span>
                  <Barra
                    valor={a.diasCobertura}
                    maximo={30}
                    critico={3}
                    alerta={10}
                    etiqueta={`Días de cobertura de ${a.producto.nombre}`}
                  />
                </Entrada>
              ))}
              {d.alertas.reposicion.total > d.alertas.reposicion.items.length && (
                <li className="text-xs text-t3 sm:col-span-2">
                  {d.alertas.reposicion.total} productos por reponer en total
                  {d.alertas.reposicion.criticas > 0
                    ? `, ${d.alertas.reposicion.criticas} críticos`
                    : ''}
                  .
                </li>
              )}
            </ul>
          )}
        </Entrada>
      </div>
    </section>
  );
}
