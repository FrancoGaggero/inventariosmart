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

const CHIPS: { valor: FiltroEstadoAlerta; etiqueta: string }[] = [
  { valor: 'ACTIVA', etiqueta: 'Activas' },
  { valor: 'POSPUESTA', etiqueta: 'Pospuestas' },
  { valor: 'ATENDIDA', etiqueta: 'Atendidas' },
  { valor: 'RESUELTA', etiqueta: 'Resueltas' },
  { valor: 'TODAS', etiqueta: 'Todas' },
];

const CLASE_ESTADO: Record<EstadoAlerta, string> = {
  ACTIVA: 'bg-warn/15 text-warn',
  POSPUESTA: 'bg-white/10 text-t2',
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
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              estado === c.valor
                ? 'bg-brand/15 text-brand-3 border-brand/40'
                : 'text-t2 border-white/10 hover:text-t1'
            }`}
          >
            {c.etiqueta}
            {c.valor === 'ACTIVA' && resumen.data ? ` · ${resumen.data.activas}` : ''}
          </button>
        ))}
      </div>

      {alertas.isError && <Aviso tono="error">{mensajeDe(alertas.error)}</Aviso>}

      {alertas.isSuccess && items.length === 0 ? (
        <div className="card p-8 text-center">
          <CheckCircle2 className="w-8 h-8 text-ok mx-auto mb-2" aria-hidden />
          <p className="font-semibold">
            {estado === 'ACTIVA'
              ? 'No hay productos por reponer.'
              : 'No hay alertas en este estado.'}
          </p>
          <p className="text-t2 text-sm mt-1">
            El cálculo usa las ventas de los últimos 30 días y el lead time del proveedor principal
            (RN-04). Podés ajustar la anticipación por producto desde Inventario.
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-t2">
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
              {items.map((a) => {
                const abierta = a.estado === 'ACTIVA' || a.estado === 'POSPUESTA';
                const critica = a.severidad === 'CRITICA';
                return (
                  <tr key={a.id} className="border-t border-white/8 align-top">
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
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 font-semibold ${
                          critica ? 'text-crit' : 'text-warn'
                        }`}
                      >
                        <AlertTriangle className="w-3.5 h-3.5" aria-hidden />
                        {formatearCobertura(a.diasCobertura)}
                      </span>
                      <div className="text-[11px] text-t3">{ETIQUETA_SEVERIDAD[a.severidad]}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {a.puntoReposicion} · {a.umbral}
                      <div className="text-[11px] text-t3">anticipación {a.diasAnticipacion} d</div>
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
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded-md text-xs font-semibold ${CLASE_ESTADO[a.estado]}`}
                      >
                        {ETIQUETA_ESTADO_ALERTA[a.estado]}
                      </span>
                      {a.estado === 'POSPUESTA' && a.pospuestaHasta && (
                        <div className="text-[11px] text-t3">
                          hasta {formatearCalculo(a.pospuestaHasta)}
                        </div>
                      )}
                      {a.estado === 'ATENDIDA' && a.ordenCompraId && (
                        <div className="text-[11px] text-t3">
                          <Link to={`/ordenes/${a.ordenCompraId}`} className="hover:underline">
                            por orden de compra
                          </Link>
                        </div>
                      )}
                    </td>
                    {esDuenio && (
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-end gap-2">
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
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {alertas.hasNextPage && (
            <div className="p-3 text-center border-t border-white/8">
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
        </div>
      )}
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
