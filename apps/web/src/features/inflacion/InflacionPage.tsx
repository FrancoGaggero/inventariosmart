import {
  ESTADOS_PRECIO,
  ETIQUETA_ESTADO_PRECIO,
  ETIQUETA_MOTIVO_COMPARACION,
  PERIODOS_INFLACION,
  planCumple,
  type EstadoPrecio,
  type ProductoInflacion,
} from '@inventariosmart/shared';
import { Flame, LineChart, type LucideIcon, Scale, Tag, Tags, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import { formatearMes } from '@/lib/gastos';
import {
  CLASE_ESTADO_PRECIO,
  etiquetasDeMes,
  formatearVariacion,
  fraseInflacion,
  useComparacionInflacion,
  useIndicadores,
} from '@/lib/inflacion';
import { useMe } from '@/lib/me';
import { formatearPesos } from '@/lib/productos';
import { Aviso } from '@/ui/Aviso';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { GraficoLineas, type SerieGrafico } from '@/ui/GraficoLineas';
import { Skeleton, SkeletonFilas } from '@/ui/Skeleton';

const PAGINA = 25;

const TONO = {
  brand: 'bg-brand/15 text-brand-3',
  warn: 'bg-warn/15 text-warn',
  violet: 'bg-violet/15 text-violet',
  ok: 'bg-ok/15 text-ok',
  crit: 'bg-crit/15 text-crit',
} as const;

function Kpi({
  indice,
  titulo,
  Icono,
  tono,
  cargando,
  valor,
  claseValor = '',
  detalle,
}: {
  indice: number;
  titulo: string;
  Icono: LucideIcon;
  tono: keyof typeof TONO;
  cargando: boolean;
  valor: string | null;
  claseValor?: string;
  detalle: string;
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
              className={`text-lg sm:text-xl font-extrabold leading-tight mt-0.5 whitespace-nowrap tabular-nums ${claseValor}`}
            >
              {valor === null ? '—' : formatearVariacion(valor, true)}
            </dd>
            <dd className="text-xs text-t3 mt-1 truncate">{detalle}</dd>
          </>
        )}
      </div>
    </Entrada>
  );
}

function ChipEstado({ estado }: { estado: EstadoPrecio | null }) {
  if (estado === null) return <span className="text-t3">—</span>;
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[11px] font-bold whitespace-nowrap ${CLASE_ESTADO_PRECIO[estado]}`}
    >
      {ETIQUETA_ESTADO_PRECIO[estado]}
    </span>
  );
}

const variacion = (v: string | null) => (v === null ? '—' : formatearVariacion(v, true));
const claseReal = (v: string | null) =>
  v === null ? 'text-t3' : Number(v) < 0 ? 'text-crit' : 'text-ok';

/** Mis precios frente a la inflación (HU-15). DUENIO y CONTADOR, plan PRO. */
export function InflacionPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const [meses, setMeses] = useState<number>(6);
  const [filtro, setFiltro] = useState<EstadoPrecio | null>(null);
  const [visibles, setVisibles] = useState(PAGINA);

  const indicadores = useIndicadores(tienePlan);
  const comparacion = useComparacionInflacion(
    meses,
    indicadores.data?.ipc?.periodo,
    tienePlan && !indicadores.isPending,
  );
  const c = comparacion.data;
  const cargando = tienePlan && (indicadores.isPending || comparacion.isPending);

  const aNumeros = (serie: (string | null)[]) => serie.map((v) => (v === null ? null : Number(v)));
  const series: SerieGrafico[] = c
    ? [
        {
          id: 'misPrecios',
          nombre: 'Mis precios',
          color: 'var(--color-brand-3)',
          valores: aNumeros(c.series.misPrecios),
        },
        {
          id: 'misCostos',
          nombre: 'Mis costos',
          color: 'var(--color-warn)',
          valores: aNumeros(c.series.misCostos),
        },
        {
          id: 'ipc',
          nombre: 'Inflación (IPC)',
          color: 'var(--color-violet)',
          valores: aNumeros(c.series.ipc),
        },
        {
          id: 'ipcBienes',
          nombre: 'IPC bienes',
          color: 'var(--color-t3)',
          valores: aNumeros(c.series.ipcBienes),
          punteada: true,
        },
      ]
    : [];

  const conteo = (estado: EstadoPrecio) =>
    c?.productos.filter((p) => p.estado === estado).length ?? 0;
  const productos = (c?.productos ?? []).filter((p) => filtro === null || p.estado === filtro);
  const pagina = productos.slice(0, visibles);
  const elegirFiltro = (estado: EstadoPrecio | null) => {
    setFiltro(estado);
    setVisibles(PAGINA);
  };

  const porInflacion = (p: ProductoInflacion) =>
    p.precioSugeridoInflacion === null ? '—' : formatearPesos(p.precioSugeridoInflacion);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <LineChart className="w-6 h-6 text-brand-3 shrink-0" aria-hidden />
            Precios e inflación
          </h1>
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            {!tienePlan
              ? '¿Tus precios le ganan o le pierden a la inflación?'
              : c
                ? fraseInflacion(c)
                : comparacion.isError
                  ? mensajeDe(comparacion.error)
                  : 'Comparando tus precios con la inflación…'}
          </p>
        </div>
        {tienePlan && (
          <div className="flex gap-2" role="group" aria-label="Período">
            {PERIODOS_INFLACION.map((n) => (
              <button
                key={n}
                type="button"
                className={`chip ${meses === n ? 'chip-activo' : ''}`}
                aria-pressed={meses === n}
                onClick={() => {
                  setMeses(n);
                  setVisibles(PAGINA);
                }}
              >
                {n} meses
              </button>
            ))}
          </div>
        )}
      </header>

      {me.data && !tienePlan && (
        <Aviso tono="plan">
          Disponible en el plan PRO: compará tus precios y costos con la inflación oficial del INDEC
          y mirá qué productos quedaron atrasados, con un precio sugerido para cada uno.
        </Aviso>
      )}
      {indicadores.data?.desactualizado && (
        <Aviso tono="warn">
          No pudimos actualizar los datos del INDEC y del BCRA: estás viendo los últimos que
          guardamos.
        </Aviso>
      )}
      {c?.motivo === 'SIN_IPC' && <Aviso tono="warn">{ETIQUETA_MOTIVO_COMPARACION.SIN_IPC}</Aviso>}

      {tienePlan && (
        <>
          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <Kpi
              indice={0}
              titulo="Mis precios"
              Icono={Tag}
              tono="brand"
              cargando={cargando}
              valor={c?.variaciones.misPrecios ?? null}
              detalle="Lo que más vendés pesa más"
            />
            <Kpi
              indice={1}
              titulo="Mis costos"
              Icono={Truck}
              tono="warn"
              cargando={cargando}
              valor={c?.variaciones.misCostos ?? null}
              detalle={
                c?.brechas.preciosVsCostos == null
                  ? 'Costos de tu proveedor principal'
                  : Number(c.brechas.preciosVsCostos) < 0
                    ? `Tus precios, ${formatearVariacion(c.brechas.preciosVsCostos)} abajo`
                    : `Tus precios, ${formatearVariacion(c.brechas.preciosVsCostos)} arriba`
              }
            />
            <Kpi
              indice={2}
              titulo="Inflación"
              Icono={Flame}
              tono="violet"
              cargando={cargando}
              valor={c?.variaciones.ipc ?? null}
              detalle={
                c?.variaciones.ipcBienes == null
                  ? 'IPC nacional del INDEC'
                  : `Sólo bienes: ${formatearVariacion(c.variaciones.ipcBienes, true)}`
              }
            />
            <Kpi
              indice={3}
              titulo="En términos reales"
              Icono={Scale}
              tono={
                c?.brechas.preciosVsIpc != null && Number(c.brechas.preciosVsIpc) < 0
                  ? 'crit'
                  : 'ok'
              }
              cargando={cargando}
              valor={c?.brechas.preciosVsIpc ?? null}
              claseValor={c ? claseReal(c.brechas.preciosVsIpc) : ''}
              detalle="Descontada la inflación"
            />
          </dl>

          <section className="card p-4 sm:p-5" aria-labelledby="titulo-grafico">
            <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
              <h2 id="titulo-grafico" className="font-bold">
                Evolución en índice base 100
              </h2>
              {c && (
                <p className="text-xs text-t3 first-letter:uppercase">
                  {formatearMes(c.desde)} a {formatearMes(c.hasta)}
                </p>
              )}
            </div>
            {cargando || !c ? (
              <Skeleton variante="bloque" className="!h-64" />
            ) : (
              <GraficoLineas
                etiquetas={c.meses.map(etiquetasDeMes)}
                series={series}
                resumen={`Gráfico de líneas en índice base 100. ${fraseInflacion(c)}`}
              />
            )}
            {c && (
              <p className="text-xs text-t3 mt-3">
                Fuente: INDEC, índice de precios al consumidor nacional. Se publica con un mes de
                rezago: la comparación llega hasta {formatearMes(c.hasta)}
                {c.recortado ? ' (el período pedido se recortó a ese mes)' : ''}. Todas las líneas
                arrancan en 100 para poder compararlas.
              </p>
            )}
          </section>

          {c?.motivo === 'SIN_VENTAS' && (
            <div className="card">
              <EstadoVacio
                ilustracion="flechas"
                titulo="No hubo ventas en el período."
                texto="El índice de tus precios se arma con lo que vendiste: los productos que más vendés pesan más. Igual podés ver abajo cómo se movió el precio de cada producto."
                accion={
                  esDuenio && (
                    <Link to="/movimientos/nuevo" className="btn btn-primary">
                      Registrar una venta
                    </Link>
                  )
                }
              />
            </div>
          )}

          <section className="space-y-3" aria-labelledby="titulo-productos">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="titulo-productos" className="font-bold">
                  Producto por producto
                </h2>
                <p className="text-xs text-t2 max-w-2xl">
                  Los precios sugeridos son una referencia: uno acompaña a la inflación y el otro
                  sostiene el margen que tenías al inicio. No cambian nada hasta que edites el
                  precio.
                </p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por estado">
                {c && c.productos.length > 0 && (
                  <Link
                    to={`/remarcar?criterio=INFLACION&desde=${c.desde}&hasta=${c.hasta}${
                      conteo('ATRASADO') > 0 ? '&estado=ATRASADO' : ''
                    }`}
                    className="btn btn-primary !py-2 !px-3"
                  >
                    <Tags className="w-4 h-4" aria-hidden />
                    Remarcar
                  </Link>
                )}
                <button
                  type="button"
                  className={`chip ${filtro === null ? 'chip-activo' : ''}`}
                  aria-pressed={filtro === null}
                  onClick={() => elegirFiltro(null)}
                >
                  Todos{c ? ` (${c.productos.length})` : ''}
                </button>
                {ESTADOS_PRECIO.map((e) => (
                  <button
                    key={e}
                    type="button"
                    className={`chip ${filtro === e ? 'chip-activo' : ''}`}
                    aria-pressed={filtro === e}
                    onClick={() => elegirFiltro(e)}
                  >
                    {ETIQUETA_ESTADO_PRECIO[e]}s ({conteo(e)})
                  </button>
                ))}
              </div>
            </div>

            <div className="card overflow-hidden">
              {cargando && <SkeletonFilas filas={5} />}
              {c && productos.length === 0 && (
                <EstadoVacio
                  ilustracion="cajas"
                  titulo={
                    filtro === null
                      ? 'Todavía no hay productos activos.'
                      : `No hay productos ${ETIQUETA_ESTADO_PRECIO[filtro].toLowerCase()}s.`
                  }
                />
              )}
              {pagina.length > 0 && (
                <>
                  <div className="hidden md:block overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="text-xs text-t2 text-left">
                        <tr className="border-b border-line">
                          <th scope="col" className="font-semibold px-4 py-3">
                            Producto
                          </th>
                          <th scope="col" className="font-semibold px-3 py-3 text-right">
                            Precio
                          </th>
                          <th
                            scope="col"
                            className="font-semibold px-3 py-3 text-right hidden lg:table-cell"
                          >
                            Costo
                          </th>
                          <th scope="col" className="font-semibold px-3 py-3 text-right">
                            Real
                          </th>
                          <th scope="col" className="font-semibold px-3 py-3">
                            Estado
                          </th>
                          <th scope="col" className="font-semibold px-3 py-3 text-right">
                            Sugerido por inflación
                          </th>
                          <th scope="col" className="font-semibold px-4 py-3 text-right">
                            Sugerido por margen
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagina.map((p) => (
                          <tr key={p.producto.id} className="border-b border-line last:border-0">
                            <th scope="row" className="px-4 py-3 text-left font-normal min-w-0">
                              {esDuenio ? (
                                <Link
                                  to={`/productos/${p.producto.id}`}
                                  className="font-semibold hover:text-brand-3"
                                >
                                  {p.producto.nombre}
                                </Link>
                              ) : (
                                <span className="font-semibold">{p.producto.nombre}</span>
                              )}
                              <div className="text-xs text-t3 font-mono">
                                {p.producto.codigo} · {p.unidadesVendidas} vendidas
                              </div>
                            </th>
                            <td className="px-3 py-3 text-right whitespace-nowrap">
                              <div className="tabular-nums">{formatearPesos(p.precioFinal)}</div>
                              <div className="text-xs text-t3 tabular-nums">
                                {variacion(p.variacionPrecio)}
                                <span className="hidden lg:inline">
                                  {' '}
                                  desde {formatearPesos(p.precioInicial)}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap hidden lg:table-cell">
                              <div className="tabular-nums">{formatearPesos(p.costoFinal)}</div>
                              <div className="text-xs text-t3 tabular-nums">
                                {variacion(p.variacionCosto)}
                              </div>
                            </td>
                            <td
                              className={`px-3 py-3 text-right font-semibold tabular-nums whitespace-nowrap ${claseReal(p.variacionReal)}`}
                            >
                              {variacion(p.variacionReal)}
                            </td>
                            <td className="px-3 py-3">
                              <ChipEstado estado={p.estado} />
                            </td>
                            <td className="px-3 py-3 text-right whitespace-nowrap tabular-nums">
                              {porInflacion(p)}
                            </td>
                            <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums">
                              {formatearPesos(p.precioSugeridoMargen)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <ul className="md:hidden divide-y divide-line">
                    {pagina.map((p) => (
                      <li key={p.producto.id} className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {esDuenio ? (
                              <Link
                                to={`/productos/${p.producto.id}`}
                                className="font-semibold block truncate"
                              >
                                {p.producto.nombre}
                              </Link>
                            ) : (
                              <span className="font-semibold block truncate">
                                {p.producto.nombre}
                              </span>
                            )}
                            <div className="text-xs text-t3 font-mono truncate">
                              {p.producto.codigo} · {p.unidadesVendidas} vendidas
                            </div>
                          </div>
                          <ChipEstado estado={p.estado} />
                        </div>
                        <dl className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <dt className="text-t3">Precio</dt>
                            <dd className="font-semibold tabular-nums">
                              {variacion(p.variacionPrecio)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-t3">Costo</dt>
                            <dd className="font-semibold tabular-nums">
                              {variacion(p.variacionCosto)}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-t3">Real</dt>
                            <dd
                              className={`font-semibold tabular-nums ${claseReal(p.variacionReal)}`}
                            >
                              {variacion(p.variacionReal)}
                            </dd>
                          </div>
                        </dl>
                        <p className="text-xs text-t2">
                          Hoy <b className="text-t1">{formatearPesos(p.precioFinal)}</b>. Sugerido
                          por inflación {porInflacion(p)} y por margen{' '}
                          {formatearPesos(p.precioSugeridoMargen)}.
                        </p>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>

            {productos.length > visibles && (
              <div className="text-center">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setVisibles((v) => v + PAGINA)}
                >
                  Ver más ({productos.length - visibles} restantes)
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
