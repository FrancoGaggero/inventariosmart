import { planCumple, type DiasQuiebres, type ProductoConQuiebres } from '@inventariosmart/shared';
import { BellRing, CalendarClock, PackageX, TrendingDown } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import {
  DIAS_QUIEBRES,
  EXPLICACION_QUIEBRES,
  diasLegibles,
  SIN_HISTORIAL,
  SIN_STOCK_AHORA,
  etiquetaPeriodo,
  formatearPerdida,
  fraseTotales,
  textoGanancia,
  unidadesLegibles,
  useQuiebres,
} from '@/lib/quiebres';
import { Aviso } from '@/ui/Aviso';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';

function Estado({ producto }: { producto: ProductoConQuiebres }) {
  if (!producto.enCurso) return null;
  return (
    <span className="inline-block px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap bg-crit/15 text-crit">
      {SIN_STOCK_AHORA}
    </span>
  );
}

function Tarjeta({
  titulo,
  valor,
  detalle,
  Icono,
  tono,
  indice,
}: {
  titulo: string;
  valor: string;
  detalle: string;
  Icono: typeof PackageX;
  tono: 'crit' | 'warn' | 'brand';
  indice: number;
}) {
  const color = { crit: 'text-crit', warn: 'text-warn', brand: 'text-brand-3' }[tono];
  return (
    <Entrada as="div" indice={indice} className="card p-5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-t3 flex items-center gap-2">
        <Icono className={`w-4 h-4 ${color}`} aria-hidden />
        {titulo}
      </dt>
      <dd className="mt-2 text-2xl font-extrabold tabular-nums">{valor}</dd>
      <dd className="text-xs text-t2 mt-1">{detalle}</dd>
    </Entrada>
  );
}

/** Pérdidas por falta de stock (/quiebres, HU-18). Plan PRO; DUENIO y CONTADOR. */
export function QuiebresPage() {
  const me = useMe();
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const [dias, setDias] = useState<DiasQuiebres>(30);
  const quiebres = useQuiebres(dias, tienePlan);
  const items = quiebres.data?.pages.flatMap((p) => p.items) ?? [];
  const totales = quiebres.data?.pages[0]?.totales;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <PackageX className="w-6 h-6 text-crit" aria-hidden />
            Falta de stock
          </h1>
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            {quiebres.isError
              ? mensajeDe(quiebres.error)
              : totales
                ? fraseTotales(totales, dias)
                : 'Cuánto dejaste de vender y de ganar por quedarte sin stock.'}
          </p>
        </div>
        {tienePlan && (
          <Link to="/alertas" className="btn btn-ghost">
            <BellRing className="w-4 h-4" aria-hidden />
            Alertas de reposición
          </Link>
        )}
      </header>

      {me.data && !tienePlan && (
        <Aviso tono="plan">
          Disponible en el plan PRO: mirá cuánto dejaste de ganar cada vez que un producto se quedó
          sin stock.
        </Aviso>
      )}

      {tienePlan && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Período">
          {DIAS_QUIEBRES.map((d) => (
            <button
              key={d}
              type="button"
              role="radio"
              aria-checked={dias === d}
              className={`chip ${dias === d ? 'chip-activo' : ''}`}
              onClick={() => setDias(d)}
            >
              {etiquetaPeriodo(d)}
            </button>
          ))}
        </div>
      )}

      {tienePlan && quiebres.isPending && (
        <div className="card">
          <SkeletonFilas filas={5} />
        </div>
      )}

      {tienePlan && totales && (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <Tarjeta
              indice={0}
              titulo="Ganancia perdida"
              Icono={TrendingDown}
              tono="crit"
              valor={formatearPerdida(totales.gananciaPerdida)}
              detalle="Margen bruto, sin IVA"
            />
            <Tarjeta
              indice={1}
              titulo="Ventas perdidas"
              Icono={PackageX}
              tono="warn"
              valor={formatearPerdida(totales.ventaPerdida)}
              detalle={`${unidadesLegibles(totales.unidadesPerdidas)}, sin IVA`}
            />
            <Tarjeta
              indice={2}
              titulo="Productos afectados"
              Icono={CalendarClock}
              tono="brand"
              valor={String(totales.productosAfectados)}
              detalle={
                totales.enCurso === 0
                  ? 'Ninguno sigue sin stock'
                  : `${totales.enCurso} ${totales.enCurso === 1 ? 'sigue' : 'siguen'} sin stock`
              }
            />
          </dl>

          {items.length === 0 ? (
            <div className="card">
              <EstadoVacio
                ilustracion="cajas"
                titulo="No te quedaste sin stock en este período."
                texto="Las alertas de reposición te avisan antes de que un producto se agote."
              />
            </div>
          ) : (
            <>
              <section className="card overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-t3 bg-fill">
                      <tr>
                        <th className="text-left px-5 py-3">Producto</th>
                        <th className="text-right px-3 py-3">Sin stock</th>
                        <th className="text-right px-3 py-3 hidden lg:table-cell">
                          Vendía por día
                        </th>
                        <th className="text-right px-3 py-3">Unidades perdidas</th>
                        <th className="text-right px-3 py-3">Ganancia perdida</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.producto.id} className="border-t border-line align-top">
                          <td className="px-5 py-3">
                            <div className="font-semibold">{p.producto.nombre}</div>
                            <div className="text-xs text-t3">
                              <span className="font-mono">{p.producto.codigo}</span>
                              {p.quiebres > 1 && ` · ${p.quiebres} veces`}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                            {diasLegibles(p.diasSinStock)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap hidden lg:table-cell">
                            {p.demandaDiaria === null ? '—' : unidadesLegibles(p.demandaDiaria)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                            {unidadesLegibles(p.unidadesPerdidas)}
                          </td>
                          <td
                            className={`px-3 py-3 text-right tabular-nums whitespace-nowrap ${
                              p.gananciaPerdida === null ? 'text-xs text-t3' : 'font-semibold'
                            }`}
                          >
                            {textoGanancia(p)}
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <Estado producto={p} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <ul className="space-y-3 md:hidden">
                {items.map((p, n) => (
                  <Entrada as="li" indice={n} key={p.producto.id} className="card p-4 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold break-words">{p.producto.nombre}</p>
                        <p className="text-xs text-t3">
                          <span className="font-mono">{p.producto.codigo}</span> · sin stock{' '}
                          {diasLegibles(p.diasSinStock)}
                        </p>
                      </div>
                      <Estado producto={p} />
                    </div>
                    {p.gananciaPerdida === null && (
                      <p className="text-xs text-t3">{SIN_HISTORIAL}</p>
                    )}
                    {p.gananciaPerdida !== null && (
                      <p className="text-sm tabular-nums">
                        Dejaste de ganar{' '}
                        <span className="font-semibold text-crit">
                          {formatearPerdida(p.gananciaPerdida)}
                        </span>{' '}
                        ({unidadesLegibles(p.unidadesPerdidas)})
                      </p>
                    )}
                  </Entrada>
                ))}
              </ul>
            </>
          )}

          {quiebres.hasNextPage && (
            <div className="text-center">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void quiebres.fetchNextPage()}
                disabled={quiebres.isFetchingNextPage}
              >
                {quiebres.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
              </button>
            </div>
          )}

          <p className="text-xs text-t3 max-w-2xl">{EXPLICACION_QUIEBRES}</p>
        </>
      )}
    </div>
  );
}
