import { planCumple, type InsumoComparado } from '@inventariosmart/shared';
import { ArrowLeft, ArrowRight, Scale, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import {
  formatearAhorro,
  formatearCosto,
  formatearPuntaje,
  fraseTotales,
  useComparador,
} from '@/lib/comparador';
import { useMe } from '@/lib/me';
import { Aviso } from '@/ui/Aviso';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';

const detalleDe = (i: InsumoComparado) => `/proveedores/comparador/${i.producto.id}`;

function Estado({ insumo }: { insumo: InsumoComparado }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold whitespace-nowrap ${
        insumo.cambiaProveedor ? 'bg-warn/15 text-warn' : 'bg-ok/15 text-ok'
      }`}
    >
      {insumo.cambiaProveedor ? 'Conviene cambiar' : 'Ya es el principal'}
    </span>
  );
}

/** Comparador de proveedores (/proveedores/comparador, HU-12). Plan PREMIUM, sólo DUENIO. */
export function ComparadorPage() {
  const me = useMe();
  const tienePlan = me.data ? planCumple(me.data.plan, 'PREMIUM') : false;
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [soloOportunidades, setSoloOportunidades] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setQ(texto.trim()), 300);
    return () => clearTimeout(id);
  }, [texto]);

  const comparador = useComparador({ soloOportunidades, q }, tienePlan);
  const items = comparador.data?.pages.flatMap((p) => p.items) ?? [];
  const totales = comparador.data?.pages[0]?.totales;
  const sinComparables = totales?.comparables === 0;

  return (
    <div className="space-y-6">
      <Link
        to="/proveedores"
        className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Proveedores
      </Link>

      <header>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <Scale className="w-6 h-6 text-brand-3" aria-hidden />
          Comparador
        </h1>
        <p className="text-t2 text-sm mt-1 max-w-2xl">
          {comparador.isError
            ? mensajeDe(comparador.error)
            : totales
              ? fraseTotales(totales)
              : 'Compará a tus proveedores por precio, plazo de entrega y confiabilidad.'}
        </p>
      </header>

      {me.data && !tienePlan && (
        <Aviso tono="plan">
          Disponible en el plan PREMIUM: compará a tus proveedores insumo por insumo y mirá con
          quién te conviene comprar.
        </Aviso>
      )}

      {tienePlan && comparador.isPending && (
        <div className="card">
          <SkeletonFilas filas={5} />
        </div>
      )}

      {tienePlan && sinComparables && (
        <div className="card">
          <EstadoVacio
            ilustracion="camion"
            titulo="Todavía no hay nada para comparar."
            texto="Para comparar hace falta que un mismo producto tenga costos de dos proveedores o más. Cargá o importá la lista de precios de cada uno."
            accion={
              <Link to="/proveedores" className="btn btn-primary">
                Ir a proveedores
              </Link>
            }
          />
        </div>
      )}

      {tienePlan && totales && !sinComparables && (
        <>
          <div className="flex flex-col md:flex-row gap-3">
            <label className="relative flex-1">
              <Search
                className="w-4 h-4 text-t3 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden
              />
              <input
                type="search"
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                placeholder="Buscar por código o nombre…"
                aria-label="Buscar insumo"
                className="campo !pl-9 !py-2.5"
              />
            </label>
            <button
              type="button"
              className={`chip ${soloOportunidades ? 'chip-activo' : ''}`}
              aria-pressed={soloOportunidades}
              onClick={() => setSoloOportunidades((s) => !s)}
            >
              Sólo los que conviene cambiar
            </button>
          </div>

          {items.length === 0 ? (
            <div className="card">
              <EstadoVacio
                ilustracion="flechas"
                titulo={
                  q
                    ? 'No hay insumos que coincidan.'
                    : 'Ya le comprás al recomendado en todos tus insumos.'
                }
              />
            </div>
          ) : (
            <>
              <section className="card overflow-hidden hidden md:block">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase tracking-wider text-t3 bg-fill">
                      <tr>
                        <th className="text-left px-5 py-3">Insumo</th>
                        <th className="text-left px-3 py-3">Recomendado</th>
                        <th className="text-left px-3 py-3">Principal actual</th>
                        <th className="text-right px-3 py-3">Ahorro estimado</th>
                        <th className="px-5 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((i) => (
                        <tr key={i.producto.id} className="border-t border-line align-top">
                          <td className="px-5 py-3">
                            <Link to={detalleDe(i)} className="font-semibold hover:text-brand-3">
                              {i.producto.nombre}
                            </Link>
                            <div className="text-xs text-t3">
                              <span className="font-mono">{i.producto.codigo}</span> ·{' '}
                              {i.proveedores} proveedores
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="font-semibold">{i.recomendado.nombre}</div>
                            <div className="text-xs text-t2 tabular-nums">
                              {formatearCosto(i.recomendado.costoNeto)} ·{' '}
                              {formatearPuntaje(i.recomendado.puntaje)} puntos
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {i.principal ? (
                              <>
                                <div>{i.principal.nombre}</div>
                                <div className="text-xs text-t2 tabular-nums">
                                  {formatearCosto(i.principal.costoNeto)} ·{' '}
                                  {formatearPuntaje(i.principal.puntaje)} puntos
                                </div>
                              </>
                            ) : (
                              <span className="text-t3">Sin principal</span>
                            )}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                            {formatearAhorro(i.ahorroEstimado)}
                          </td>
                          <td className="px-5 py-3 text-right whitespace-nowrap">
                            <Estado insumo={i} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <ul className="space-y-3 md:hidden">
                {items.map((i, n) => (
                  <Entrada as="li" indice={n} key={i.producto.id} className="card">
                    <Link to={detalleDe(i)} className="block p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold break-words">{i.producto.nombre}</p>
                          <p className="text-xs text-t3">
                            <span className="font-mono">{i.producto.codigo}</span> · {i.proveedores}{' '}
                            proveedores
                          </p>
                        </div>
                        <Estado insumo={i} />
                      </div>
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="text-t2">
                          {i.principal ? i.principal.nombre : 'Sin principal'}
                        </span>
                        <ArrowRight className="w-4 h-4 text-t3 shrink-0" aria-hidden />
                        <span className="font-semibold">{i.recomendado.nombre}</span>
                        <span className="text-t2 tabular-nums">
                          {formatearCosto(i.recomendado.costoNeto)}
                        </span>
                      </div>
                      {i.ahorroEstimado !== null && (
                        <p className="text-sm text-ok font-semibold tabular-nums">
                          Ahorrás unos {formatearAhorro(i.ahorroEstimado)}
                        </p>
                      )}
                    </Link>
                  </Entrada>
                ))}
              </ul>
            </>
          )}

          {comparador.hasNextPage && (
            <div className="text-center">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void comparador.fetchNextPage()}
                disabled={comparador.isFetchingNextPage}
              >
                {comparador.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
              </button>
            </div>
          )}

          <p className="text-xs text-t3 max-w-2xl">
            El ahorro es una estimación: la diferencia de costo entre tu proveedor principal y el
            recomendado, por las unidades que vendiste en los últimos 30 días.
          </p>
        </>
      )}
    </div>
  );
}
