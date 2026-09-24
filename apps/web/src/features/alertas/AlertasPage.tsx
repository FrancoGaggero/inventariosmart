import {
  ETIQUETA_ESTADO_ALERTA,
  ETIQUETA_SEVERIDAD,
  type EstadoAlerta,
  planCumple,
} from '@inventariosmart/shared';
import {
  AlertTriangle,
  BellRing,
  CheckCircle2,
  Clock,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import {
  type Alerta,
  type FiltroEstadoAlerta,
  formatearCalculo,
  formatearCobertura,
  fraseAlertas,
  useAccionAlerta,
  useAlertas,
  useRecalcularAlertas,
  useResumenAlertas,
} from '@/lib/alertas';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import { Aviso } from '@/ui/Aviso';
import { Barra } from '@/ui/Barra';
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';

const CHIPS: { valor: FiltroEstadoAlerta; etiqueta: string }[] = [
  { valor: 'ACTIVA', etiqueta: 'Activas' },
  { valor: 'POSPUESTA', etiqueta: 'Pospuestas' },
  { valor: 'ATENDIDA', etiqueta: 'Atendidas' },
  { valor: 'RESUELTA', etiqueta: 'Resueltas' },
  { valor: 'TODAS', etiqueta: 'Todas' },
];

const CLASE_ESTADO: Record<EstadoAlerta, string> = {
  ACTIVA: 'bg-warn/15 text-warn',
  POSPUESTA: 'bg-fill text-t2',
  ATENDIDA: 'bg-brand/15 text-brand-3',
  RESUELTA: 'bg-ok/15 text-ok',
};

/** Alertas predictivas de reposición (HU-06, RN-04): DUENIO gestiona, CONTADOR consulta. */
export function AlertasPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const [estado, setEstado] = useState<FiltroEstadoAlerta>('ACTIVA');
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  const resumen = useResumenAlertas(tienePlan);
  const alertas = useAlertas(estado, tienePlan);
  const recalcular = useRecalcularAlertas();
  const accionar = useAccionAlerta();
  const items = alertas.data?.pages.flatMap((p) => p.items) ?? [];

  const accion = (a: Alerta, tipo: 'ATENDER' | 'POSPONER') => {
    setAviso(null);
    accionar.mutate(
      { id: a.id, accion: tipo },
      {
        onSuccess: () =>
          setAviso({
            tono: 'ok',
            texto:
              tipo === 'ATENDER'
                ? `${a.producto.nombre}: alerta atendida. No se vuelve a avisar hasta que entre mercadería.`
                : `${a.producto.nombre}: alerta pospuesta 7 días.`,
          }),
        onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
      },
    );
  };

  const recalcularAhora = () => {
    setAviso(null);
    recalcular.mutate(undefined, {
      onSuccess: (r) =>
        setAviso({
          tono: 'ok',
          texto: `Recalculado: ${r.creadas} nueva${r.creadas === 1 ? '' : 's'}, ${r.actualizadas} actualizada${r.actualizadas === 1 ? '' : 's'}, ${r.resueltas} resuelta${r.resueltas === 1 ? '' : 's'}.`,
        }),
      onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
    });
  };

  if (me.data && !tienePlan) {
    return (
      <div className="space-y-6">
        <Cabecera frase="Las alertas predictivas avisan antes del quiebre según tu velocidad de venta y el lead time de cada proveedor." />
        <Aviso tono="plan">
          Disponible en el plan PRO. Mientras tanto, el inicio te muestra los productos sin stock y
          con stock bajo.
        </Aviso>
      </div>
    );
  }

  /** Estado con la referencia a la orden o la fecha de posposición. */
  const estadoDe = (a: Alerta) => (
    <>
      <span
        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${CLASE_ESTADO[a.estado]}`}
      >
        {ETIQUETA_ESTADO_ALERTA[a.estado]}
      </span>
      {a.estado === 'POSPUESTA' && a.pospuestaHasta && (
        <div className="text-[11px] text-t3">hasta {formatearCalculo(a.pospuestaHasta)}</div>
      )}
      {a.estado === 'ATENDIDA' && a.ordenCompraId && (
        <div className="text-[11px] text-t3">
          <Link to={`/ordenes/${a.ordenCompraId}`} className="hover:underline">
            por orden de compra
          </Link>
        </div>
      )}
    </>
  );

  /** Acciones de una alerta, compartidas por la tabla y las tarjetas. */
  const accionesDe = (a: Alerta) => {
    const abierta = a.estado === 'ACTIVA' || a.estado === 'POSPUESTA';
    return (
      <>
        <Link
          to={`/movimientos/nuevo?productoId=${a.producto.id}&tipo=INGRESO`}
          className="btn btn-ghost !py-1 !px-2 text-xs"
        >
          Registrar ingreso
        </Link>
        {abierta && (
          <>
            <button
              type="button"
              className="btn btn-ghost !py-1 !px-2 text-xs"
              onClick={() => accion(a, 'ATENDER')}
              disabled={accionar.isPending}
            >
              <CheckCircle2 className="w-3.5 h-3.5" aria-hidden />
              Atendida
            </button>
            {a.estado === 'ACTIVA' && (
              <button
                type="button"
                className="btn btn-ghost !py-1 !px-2 text-xs"
                onClick={() => accion(a, 'POSPONER')}
                disabled={accionar.isPending}
              >
                <Clock className="w-3.5 h-3.5" aria-hidden />
                Posponer 7 días
              </button>
            )}
          </>
        )}
      </>
    );
  };

  const cobertura = (a: Alerta) => (
    <>
      <span
        className={`inline-flex items-center gap-1 font-semibold ${
          a.severidad === 'CRITICA' ? 'text-crit' : 'text-warn'
        }`}
      >
        <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
        {formatearCobertura(a.diasCobertura)}
      </span>
      <div className="text-[11px] text-t3">{ETIQUETA_SEVERIDAD[a.severidad]}</div>
      <Barra
        valor={a.diasCobertura}
        maximo={Math.max(a.leadTimeDias + a.diasAnticipacion, 1) * 2}
        critico={a.leadTimeDias}
        alerta={a.leadTimeDias + a.diasAnticipacion}
        etiqueta={`Días de cobertura de ${a.producto.nombre}`}
        className="mt-1 max-w-28"
      />
    </>
  );

  return (
    <div className="space-y-6">
      <Cabecera
        frase={resumen.isError ? mensajeDe(resumen.error) : fraseAlertas(resumen.data)}
        derecha={
          <div className="flex flex-col items-end gap-1">
            <div className="flex flex-wrap gap-2 justify-end">
              {esDuenio && (
                <Link
                  to={`/ordenes/nueva${(resumen.data?.criticas ?? 0) > 0 ? '' : '?severidad=TODAS'}`}
                  className="btn btn-primary"
                  aria-disabled={(resumen.data?.activas ?? 0) === 0}
                >
                  <ShoppingCart className="w-4 h-4" aria-hidden />
                  Generar orden
                </Link>
              )}
              {esDuenio && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={recalcularAhora}
                  disabled={recalcular.isPending}
                >
                  <RefreshCw
                    className={`w-4 h-4 ${recalcular.isPending ? 'animate-spin' : ''}`}
                    aria-hidden
                  />
                  Recalcular ahora
                </button>
              )}
            </div>
            <span className="text-[11px] text-t3">
              Último cálculo: {formatearCalculo(resumen.data?.calculadasEn ?? null)}
            </span>
          </div>
        }
      />

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

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
            {c.valor === 'ACTIVA' && resumen.data ? ` · ${resumen.data.activas}` : ''}
          </button>
        ))}
      </div>

      {alertas.isError && <Aviso tono="error">{mensajeDe(alertas.error)}</Aviso>}

      <section className="card">
        {alertas.isPending && <SkeletonFilas filas={4} />}
        {alertas.isSuccess && items.length === 0 && (
          <EstadoVacio
            ilustracion="campana"
            titulo={
              estado === 'ACTIVA'
                ? 'No hay productos por reponer.'
                : 'No hay alertas en este estado.'
            }
            texto="El cálculo usa las ventas de los últimos 30 días y el lead time del proveedor principal (RN-04). Podés ajustar la anticipación por producto desde Inventario."
          />
        )}

        {items.length > 0 && (
          <>
            <ul className="sm:hidden divide-y divide-line">
              {items.map((a, i) => (
                <Entrada as="li" indice={i} key={a.id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        to={`/productos/${a.producto.id}`}
                        className="font-semibold hover:underline"
                      >
                        {a.producto.nombre}
                      </Link>
                      <div className="text-xs text-t3 font-mono">{a.producto.codigo}</div>
                    </div>
                    <div className="text-right shrink-0">{estadoDe(a)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>{cobertura(a)}</div>
                    <dl className="space-y-1 text-right">
                      <div>
                        <dt className="inline text-t3">Stock </dt>
                        <dd className="inline font-semibold tabular-nums">
                          {a.producto.stockActual}
                        </dd>
                      </div>
                      <div>
                        <dt className="inline text-t3">Sugerido </dt>
                        <dd className="inline font-semibold tabular-nums">{a.cantidadSugerida}</dd>
                      </div>
                      <div>
                        <dt className="inline text-t3">Proveedor </dt>
                        <dd className="inline">{a.proveedor?.nombre ?? 'sin proveedor'}</dd>
                      </div>
                    </dl>
                  </div>
                  {esDuenio && <div className="flex flex-wrap gap-2">{accionesDe(a)}</div>}
                </Entrada>
              ))}
            </ul>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="thead-fija text-left text-xs text-t2">
                  <tr>
                    <th className="px-4 py-3">Producto</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Ventas/día</th>
                    <th className="px-4 py-3">Cobertura</th>
                    <th className="px-4 py-3 text-right">Punto · umbral</th>
                    <th className="px-4 py-3">Proveedor</th>
                    <th className="px-4 py-3 text-right">Sugerido</th>
                    <th className="px-4 py-3">Estado</th>
                    {esDuenio && <th className="px-4 py-3 text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {items.map((a, i) => (
                    <Entrada
                      as="tr"
                      indice={i}
                      key={a.id}
                      className="border-t border-line align-top transition-colors hover:bg-fill"
                    >
                      <td className="px-4 py-3">
                        <Link
                          to={`/productos/${a.producto.id}`}
                          className="font-semibold hover:underline"
                        >
                          {a.producto.nombre}
                        </Link>
                        <div className="text-xs text-t3 font-mono">{a.producto.codigo}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {a.producto.stockActual}
                        <div className="text-[11px] text-t3">mín. {a.producto.stockSeguridad}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">{a.velocidadDiaria}</td>
                      <td className="px-4 py-3">{cobertura(a)}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {a.puntoReposicion} · {a.umbral}
                        <div className="text-[11px] text-t3">
                          anticipación {a.diasAnticipacion} d
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {a.proveedor ? (
                          <>
                            {a.proveedor.nombre}
                            <div className="text-[11px] text-t3">lead time {a.leadTimeDias} d</div>
                          </>
                        ) : (
                          <span className="text-t3">
                            sin proveedor
                            <div className="text-[11px]">
                              lead time {a.leadTimeDias} d por defecto
                            </div>
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {a.cantidadSugerida}
                      </td>
                      <td className="px-4 py-3">{estadoDe(a)}</td>
                      {esDuenio && (
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap justify-end gap-2">{accionesDe(a)}</div>
                        </td>
                      )}
                    </Entrada>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {alertas.hasNextPage && (
          <div className="p-3 text-center border-t border-line">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => void alertas.fetchNextPage()}
              disabled={alertas.isFetchingNextPage}
            >
              Cargar más
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function Cabecera({ frase, derecha }: { frase: string; derecha?: React.ReactNode }) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
          <BellRing className="w-6 h-6 text-warn" aria-hidden />
          Alertas de reposición
        </h1>
        <p className="text-t2 text-sm mt-1 max-w-2xl">{frase}</p>
      </div>
      {derecha}
    </header>
  );
}
