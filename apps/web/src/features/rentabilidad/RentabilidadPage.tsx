import { ETIQUETA_MOTIVO_RESUMEN, mesActual, type Mes } from '@inventariosmart/shared';
import { Search, TrendingUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import { formatearMes } from '@/lib/gastos';
import { formatearPesos } from '@/lib/productos';
import {
  claseSigno,
  formatearPct,
  useRentabilidad,
  useResumenRentabilidad,
} from '@/lib/rentabilidad';
import { Aviso } from '@/ui/Aviso';
import { SelectorMes } from '@/ui/SelectorMes';

/** Margen bruto y neto por producto y consolidado del mes (HU-03). DUENIO y CONTADOR. */
export function RentabilidadPage() {
  const [periodo, setPeriodo] = useState<Mes>(mesActual());
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  useEffect(() => {
    const id = setTimeout(() => setQ(texto.trim()), 300);
    return () => clearTimeout(id);
  }, [texto]);

  const resumen = useResumenRentabilidad(periodo);
  const lista = useRentabilidad(periodo, q);
  const items = lista.data?.pages.flatMap((p) => p.items) ?? [];
  const cabecera = lista.data?.pages[0];
  const r = resumen.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Rentabilidad</h1>
          <p className="text-t2 text-sm mt-1">
            Márgenes netos de IVA: precio neto menos costo vigente (bruto) y menos el gasto por
            unidad vendida del mes (neto).
          </p>
        </div>
        <SelectorMes valor={periodo} onChange={setPeriodo} />
      </header>

      <section className="space-y-3">
        <h2 className="font-bold capitalize">{formatearMes(periodo)}</h2>
        {resumen.isError ? (
          <Aviso tono="error">{mensajeDe(resumen.error)}</Aviso>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 text-sm">
              <div className="card p-4">
                <dt className="text-t2">Ventas netas</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  {r ? formatearPesos(r.ventasNetas) : '…'}
                </dd>
                <dd className="text-xs text-t3 mt-1">
                  {r ? `${r.unidadesVendidas} unidades vendidas` : ''}
                </dd>
              </div>
              <div className="card p-4">
                <dt className="text-t2">Margen bruto</dt>
                <dd
                  className={`text-xl font-extrabold tabular-nums ${r ? claseSigno(r.margenBruto) : ''}`}
                >
                  {r ? formatearPesos(r.margenBruto) : '…'}
                </dd>
                <dd className="text-xs text-t3 mt-1">
                  {r
                    ? `${formatearPct(r.margenBrutoPct)} sobre ventas · costo ${formatearPesos(r.costoVendido)}`
                    : ''}
                </dd>
              </div>
              <div className="card p-4">
                <dt className="text-t2">Gastos del mes</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  {r ? formatearPesos(r.gastos) : '…'}
                </dd>
                <dd className="text-xs text-t3 mt-1">
                  <Link to="/gastos" className="text-brand-3 hover:underline">
                    Ver gastos
                  </Link>
                </dd>
              </div>
              <div className="card p-4">
                <dt className="text-t2">Margen neto</dt>
                <dd
                  className={`text-xl font-extrabold tabular-nums ${r ? claseSigno(r.margenNeto) : ''}`}
                >
                  {r ? (r.margenNeto === null ? '—' : formatearPesos(r.margenNeto)) : '…'}
                </dd>
                <dd className="text-xs text-t3 mt-1">
                  {r?.margenNeto !== null && r
                    ? `${formatearPct(r.margenNetoPct)} sobre ventas`
                    : 'No calculable'}
                </dd>
              </div>
            </dl>
            {r?.motivo && (
              <Aviso tono="warn">
                {ETIQUETA_MOTIVO_RESUMEN[r.motivo]}{' '}
                {r.motivo === 'SIN_GASTOS' && (
                  <Link to={`/gastos/nuevo?periodo=${periodo}`} className="font-semibold underline">
                    Cargar gastos
                  </Link>
                )}
              </Aviso>
            )}
          </>
        )}
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-[240px]">
          <Search
            className="w-4 h-4 text-t3 absolute left-3 top-1/2 -translate-y-1/2"
            aria-hidden
          />
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar por código o nombre…"
            aria-label="Buscar producto"
            className="campo !pl-9 !py-2.5"
          />
        </label>
        {cabecera && (
          <span className="text-xs text-t2">
            Gasto por unidad vendida:{' '}
            <b className="text-t1">
              {cabecera.gastoPorUnidad ? formatearPesos(cabecera.gastoPorUnidad) : '—'}
            </b>
          </span>
        )}
      </div>

      <section className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[860px]">
          <thead className="text-xs uppercase tracking-wider text-t3 bg-fill">
            <tr>
              <th className="text-left px-5 py-3">Producto</th>
              <th className="text-right px-3 py-3">Precio neto</th>
              <th className="text-right px-3 py-3">Costo</th>
              <th className="text-right px-3 py-3">Margen bruto</th>
              <th className="text-right px-3 py-3">%</th>
              <th className="text-right px-3 py-3">Vendidas</th>
              <th className="text-right px-3 py-3">Bruto del mes</th>
              <th className="text-right px-3 py-3">Margen neto</th>
              <th className="text-right px-5 py-3">%</th>
            </tr>
          </thead>
          <tbody>
            {lista.isPending && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-t2 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {lista.isError && (
              <tr>
                <td colSpan={9} className="px-5 py-8 text-crit">
                  {mensajeDe(lista.error)}
                </td>
              </tr>
            )}
            {lista.isSuccess && items.length === 0 && (
              <tr>
                <td colSpan={9} className="px-5 py-10 text-center text-t2">
                  <TrendingUp className="w-8 h-8 mx-auto mb-2 text-t3" aria-hidden />
                  {q ? 'No hay productos que coincidan.' : 'Todavía no hay productos activos.'}
                </td>
              </tr>
            )}
            {items.map((i) => (
              <tr key={i.producto.id} className="border-t border-line">
                <td className="px-5 py-3">
                  <div className="font-semibold">{i.producto.nombre}</div>
                  <div className="text-xs text-t2 font-mono">
                    {i.producto.codigo} · IVA {i.alicuotaIva} %
                  </div>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatearPesos(i.precioNeto)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums text-t2">
                  {formatearPesos(i.costoReposicion)}
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums font-semibold ${claseSigno(i.margenBruto)}`}
                >
                  {formatearPesos(i.margenBruto)}
                </td>
                <td className={`px-3 py-3 text-right tabular-nums ${claseSigno(i.margenBrutoPct)}`}>
                  {formatearPct(i.margenBrutoPct)}
                </td>
                <td className="px-3 py-3 text-right tabular-nums">{i.unidadesVendidas}</td>
                <td className={`px-3 py-3 text-right tabular-nums ${claseSigno(i.margenBrutoMes)}`}>
                  {formatearPesos(i.margenBrutoMes)}
                </td>
                <td
                  className={`px-3 py-3 text-right tabular-nums font-semibold ${claseSigno(i.margenNeto)}`}
                >
                  {i.margenNeto === null ? '—' : formatearPesos(i.margenNeto)}
                </td>
                <td className={`px-5 py-3 text-right tabular-nums ${claseSigno(i.margenNetoPct)}`}>
                  {formatearPct(i.margenNetoPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {lista.hasNextPage && (
          <div className="p-4 border-t border-line text-center">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={lista.isFetchingNextPage}
              onClick={() => void lista.fetchNextPage()}
            >
              {lista.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </section>
      <p className="text-xs text-t3">
        El costo de lo vendido se calcula con el costo de reposición actual de cada producto
        (RN-08), no con el del día de cada venta.
      </p>
    </div>
  );
}
