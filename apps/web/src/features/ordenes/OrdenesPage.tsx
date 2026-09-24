import { ESTADOS_ORDEN, ETIQUETA_MOTIVO_NO_ENVIO, planCumple } from '@inventariosmart/shared';
import { Plus, ShoppingCart } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { formatearCalculo } from '@/lib/alertas';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import {
  CLASE_ESTADO_ORDEN,
  type FiltroEstadoOrden,
  etiquetaEstadoOrden,
  useOrdenes,
} from '@/lib/ordenes';
import { formatearPesos } from '@/lib/productos';
import { Aviso } from '@/ui/Aviso';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';

const CHIPS: { valor: FiltroEstadoOrden; etiqueta: string }[] = [
  { valor: 'TODAS', etiqueta: 'Todas' },
  ...ESTADOS_ORDEN.map((e) => ({ valor: e, etiqueta: etiquetaEstadoOrden(e) + 's' })),
];

/** Órdenes de compra del comercio (HU-07). DUENIO opera, CONTADOR consulta. */
export function OrdenesPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const [estado, setEstado] = useState<FiltroEstadoOrden>('TODAS');
  const ordenes = useOrdenes(estado, tienePlan);
  const items = ordenes.data?.pages.flatMap((p) => p.items) ?? [];

  const etiquetaEstado = (o: (typeof items)[number]) => (
    <>
      <span
        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${CLASE_ESTADO_ORDEN[o.estado]}`}
      >
        {etiquetaEstadoOrden(o.estado)}
      </span>
      {o.motivoNoEnvio && (
        <div className="text-[11px] text-t3 max-w-xs">
          {ETIQUETA_MOTIVO_NO_ENVIO[o.motivoNoEnvio]}
        </div>
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <ShoppingCart className="w-6 h-6 text-brand-3" aria-hidden />
            Órdenes de compra
          </h1>
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            El sistema sugiere y redacta; vos revisás y confirmás con un clic. Nada se envía sin tu
            confirmación (RN-06).
          </p>
        </div>
        {esDuenio && tienePlan && (
          <Link to="/ordenes/nueva" className="btn btn-primary">
            <Plus className="w-4 h-4" aria-hidden />
            Nueva orden
          </Link>
        )}
      </header>

      {me.data && !tienePlan && (
        <Aviso tono="plan">
          Disponible en el plan PRO, junto con las alertas de reposición que la alimentan.
        </Aviso>
      )}

      {tienePlan && (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado">
            {CHIPS.map((c) => (
              <button
                key={c.valor}
                type="button"
                role="tab"
                aria-selected={estado === c.valor}
                onClick={() => setEstado(c.valor)}
                className={`chip ${estado === c.valor ? 'chip-activo' : ''}`}
              >
                {c.etiqueta}
              </button>
            ))}
          </div>

          {ordenes.isError && <Aviso tono="error">{mensajeDe(ordenes.error)}</Aviso>}

          <section className="card">
            {ordenes.isPending && <SkeletonFilas filas={4} />}
            {ordenes.isSuccess && items.length === 0 && (
              <EstadoVacio
                ilustracion="carrito"
                titulo={
                  estado === 'TODAS' ? 'Todavía no hay órdenes.' : 'No hay órdenes en este estado.'
                }
                texto="Desde “Nueva orden” el sistema arma el pedido con los productos en alerta crítica y el proveedor más conveniente."
                accion={
                  esDuenio &&
                  estado === 'TODAS' && (
                    <Link to="/ordenes/nueva" className="btn btn-primary">
                      <Plus className="w-4 h-4" aria-hidden />
                      Nueva orden
                    </Link>
                  )
                }
              />
            )}

            {items.length > 0 && (
              <>
                <ul className="sm:hidden divide-y divide-line">
                  {items.map((o, i) => (
                    <Entrada as="li" indice={i} key={o.id} className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <Link
                            to={`/ordenes/${o.id}`}
                            className="font-semibold font-mono hover:underline"
                          >
                            {o.numero}
                          </Link>
                          <div className="text-sm truncate">{o.proveedor.nombre}</div>
                        </div>
                        <div className="text-right">{etiquetaEstado(o)}</div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-t2">
                        <span>
                          {o.cantidadItems} ítem{o.cantidadItems === 1 ? '' : 's'} ·{' '}
                          {formatearCalculo(o.enviadaEn ?? o.confirmadaEn ?? o.creadoEn)}
                        </span>
                        <span className="font-semibold text-t1 tabular-nums">
                          {formatearPesos(o.totalNeto)}
                        </span>
                      </div>
                    </Entrada>
                  ))}
                </ul>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="thead-fija text-left text-xs text-t2">
                      <tr>
                        <th className="px-4 py-3">Orden</th>
                        <th className="px-4 py-3">Proveedor</th>
                        <th className="px-4 py-3 text-right">Ítems</th>
                        <th className="px-4 py-3 text-right">Total neto</th>
                        <th className="px-4 py-3">Estado</th>
                        <th className="px-4 py-3">Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((o, i) => (
                        <Entrada
                          as="tr"
                          indice={i}
                          key={o.id}
                          className="border-t border-line align-top transition-colors hover:bg-fill"
                        >
                          <td className="px-4 py-3">
                            <Link
                              to={`/ordenes/${o.id}`}
                              className="font-semibold font-mono hover:underline"
                            >
                              {o.numero}
                            </Link>
                          </td>
                          <td className="px-4 py-3">{o.proveedor.nombre}</td>
                          <td className="px-4 py-3 text-right tabular-nums">{o.cantidadItems}</td>
                          <td className="px-4 py-3 text-right tabular-nums font-semibold">
                            {formatearPesos(o.totalNeto)}
                          </td>
                          <td className="px-4 py-3">{etiquetaEstado(o)}</td>
                          <td className="px-4 py-3 text-t2 tabular-nums">
                            {formatearCalculo(o.enviadaEn ?? o.confirmadaEn ?? o.creadoEn)}
                          </td>
                        </Entrada>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {ordenes.hasNextPage && (
              <div className="p-3 text-center border-t border-line">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => void ordenes.fetchNextPage()}
                  disabled={ordenes.isFetchingNextPage}
                >
                  Cargar más
                </button>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
