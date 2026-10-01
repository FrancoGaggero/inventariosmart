import { planCumple, type DiasStockParado } from '@inventariosmart/shared';
import { Archive, Boxes, CalendarX2, PackageX, Percent } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import { RUTA_QUIEBRES } from '@/lib/quiebres-formato';
import {
  DIAS_STOCK_PARADO,
  IDEAS_STOCK_PARADO,
  diasSinVenderLegible,
  etiquetaPeriodo,
  formatearCapital,
  fraseTotales,
  ultimaVentaLegible,
  useStockParado,
} from '@/lib/stock-parado';
import { Aviso } from '@/ui/Aviso';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';
import { TarjetaResumen } from '@/ui/TarjetaResumen';

const entero = new Intl.NumberFormat('es-AR');
const decimal = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 });

/** Stock parado (/stock-parado, HU-19). Plan PRO; DUENIO y CONTADOR. */
export function StockParadoPage() {
  const me = useMe();
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const [dias, setDias] = useState<DiasStockParado>(90);
  const parado = useStockParado(dias, tienePlan);
  const items = parado.data?.pages.flatMap((p) => p.items) ?? [];
  const totales = parado.data?.pages[0]?.totales;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Archive className="w-6 h-6 text-warn" aria-hidden />
            Stock parado
          </h1>
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            {parado.isError
              ? mensajeDe(parado.error)
              : totales
                ? fraseTotales(totales, dias)
                : 'Cuánta plata tenés en productos que no se venden.'}
          </p>
        </div>
        {tienePlan && (
          <Link to={RUTA_QUIEBRES} className="btn btn-ghost">
            <PackageX className="w-4 h-4" aria-hidden />
            Falta de stock
          </Link>
        )}
      </header>

      {me.data && !tienePlan && (
        <Aviso tono="plan">
          Disponible en el plan PRO: mirá cuánta plata tenés parada en productos que no se venden
          hace meses.
        </Aviso>
      )}

      {tienePlan && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Período">
          {DIAS_STOCK_PARADO.map((d) => (
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

      {tienePlan && parado.isPending && (
        <div className="card">
          <SkeletonFilas filas={5} />
        </div>
      )}

      {tienePlan && totales && (
        <>
          <dl className="grid gap-4 sm:grid-cols-3">
            <TarjetaResumen
              indice={0}
              titulo="Plata parada"
              Icono={Archive}
              tono="warn"
              valor={formatearCapital(totales.capitalParado)}
              detalle="Al costo de reposición, sin IVA"
            />
            <TarjetaResumen
              indice={1}
              titulo="De tu stock"
              Icono={Percent}
              tono="brand"
              valor={
                totales.porcentajeDelStock === null
                  ? '—'
                  : `${decimal.format(Number(totales.porcentajeDelStock))} %`
              }
              detalle="Del valor de todo tu stock"
            />
            <TarjetaResumen
              indice={2}
              titulo="Productos"
              Icono={Boxes}
              tono="brand"
              valor={entero.format(totales.productos)}
              detalle={`${entero.format(totales.unidades)} unidades sin vender`}
            />
          </dl>

          {items.length === 0 ? (
            <div className="card">
              <EstadoVacio
                ilustracion="cajas"
                titulo="No tenés stock parado en este período."
                texto="Los productos dados de alta hace menos tiempo que el período elegido todavía no cuentan."
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
                        <th className="text-right px-3 py-3">Stock</th>
                        <th className="text-right px-3 py-3 hidden lg:table-cell">Costo</th>
                        <th className="text-left px-3 py-3">Última venta</th>
                        <th className="text-right px-3 py-3">Sin vender</th>
                        <th className="text-right px-5 py-3">Plata parada</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((p) => (
                        <tr key={p.producto.id} className="border-t border-line align-top">
                          <td className="px-5 py-3">
                            <div className="font-semibold">{p.producto.nombre}</div>
                            <div className="text-xs text-t3 font-mono">{p.producto.codigo}</div>
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums">
                            {entero.format(p.stock)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap hidden lg:table-cell">
                            {formatearCapital(p.costoReposicion)}
                          </td>
                          <td
                            className={`px-3 py-3 whitespace-nowrap ${p.ultimaVenta === null ? 'text-t3' : ''}`}
                          >
                            {ultimaVentaLegible(p.ultimaVenta)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                            {diasSinVenderLegible(p.diasSinVender)}
                          </td>
                          <td className="px-5 py-3 text-right tabular-nums whitespace-nowrap font-semibold">
                            {formatearCapital(p.capitalParado)}
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
                          <span className="font-mono">{p.producto.codigo}</span> ·{' '}
                          {entero.format(p.stock)} en stock
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums whitespace-nowrap">
                        {formatearCapital(p.capitalParado)}
                      </span>
                    </div>
                    <p className="text-sm text-t2 flex items-center gap-1.5">
                      <CalendarX2 className="w-4 h-4 text-t3 shrink-0" aria-hidden />
                      {p.ultimaVenta === null
                        ? `${ultimaVentaLegible(null)} · ${diasSinVenderLegible(p.diasSinVender)} desde el alta`
                        : `Última venta: ${ultimaVentaLegible(p.ultimaVenta)} · hace ${diasSinVenderLegible(p.diasSinVender)}`}
                    </p>
                  </Entrada>
                ))}
              </ul>
            </>
          )}

          {parado.hasNextPage && (
            <div className="text-center">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => void parado.fetchNextPage()}
                disabled={parado.isFetchingNextPage}
              >
                {parado.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
              </button>
            </div>
          )}

          <p className="text-xs text-t3 max-w-2xl">{IDEAS_STOCK_PARADO}</p>
        </>
      )}
    </div>
  );
}
