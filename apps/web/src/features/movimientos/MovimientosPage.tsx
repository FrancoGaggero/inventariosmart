import {
  ETIQUETA_MOTIVO,
  ETIQUETA_TIPO,
  TIPOS_MOVIMIENTO,
  esAnulable,
  type TipoMovimiento,
} from '@inventariosmart/shared';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import {
  ETIQUETA_TIPO_CLASE,
  diaAIso,
  formatearEfecto,
  formatearFechaHora,
  type Movimiento,
  useAnularMovimiento,
  useMovimientos,
} from '@/lib/movimientos';
import { useProducto } from '@/lib/productos';
import { Aviso } from '@/ui/Aviso';
import { EstadoVacio } from '@/ui/EstadoVacio';

type Chip = 'TODOS' | TipoMovimiento;

const CHIPS: { valor: Chip; texto: string }[] = [
  { valor: 'TODOS', texto: 'Todos' },
  ...TIPOS_MOVIMIENTO.map((t) => ({ valor: t, texto: ETIQUETA_TIPO[t] })),
];

const inputClase = 'campo !px-3 !py-2';

/** Historial de movimientos del comercio (HU-10). CONTADOR sólo consulta. */
export function MovimientosPage() {
  const me = useMe();
  const rol = me.data?.rol;
  const esDuenio = rol === 'DUENIO';
  const registra = rol === 'DUENIO' || rol === 'EMPLEADO';
  const [params, setParams] = useSearchParams();
  const productoId = params.get('productoId') ?? undefined;
  const producto = useProducto(productoId);
  const [chip, setChip] = useState<Chip>('TODOS');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  const movimientos = useMovimientos({
    productoId,
    tipo: chip === 'TODOS' ? undefined : chip,
    desde: diaAIso(desde, 'inicio'),
    hasta: diaAIso(hasta, 'fin'),
  });
  const anular = useAnularMovimiento();
  const items = movimientos.data?.pages.flatMap((p) => p.items) ?? [];
  const rangoInvalido = !!desde && !!hasta && hasta < desde;

  const confirmarAnulacion = (m: Movimiento) => {
    const texto = `¿Anular ${ETIQUETA_TIPO[m.tipo].toLowerCase()} de ${Math.abs(m.efectoStock)} × ${m.producto.nombre}? Se registra un ajuste inverso; el original queda en el historial.`;
    if (!window.confirm(texto)) return;
    setAviso(null);
    anular.mutate(
      { id: m.id },
      {
        onSuccess: (ajuste) =>
          setAviso({
            tono: 'ok',
            texto: `Movimiento anulado. ${m.producto.nombre} vuelve a ${ajuste.stockResultante} unidades.`,
          }),
        onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
      },
    );
  };

  const nuevoHref = productoId
    ? `/movimientos/nuevo?productoId=${productoId}`
    : '/movimientos/nuevo';

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Movimientos</h1>
          <p className="text-t2 text-sm mt-1">
            Ventas, ingresos y ajustes. Nada se borra: una corrección es una anulación.
          </p>
        </div>
        {registra && (
          <Link to={nuevoHref} className="btn btn-primary">
            <Plus className="w-4 h-4" aria-hidden />
            Registrar movimiento
          </Link>
        )}
      </header>

      <div className="flex flex-col md:flex-row md:items-center gap-3">
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filtrar por tipo">
          {CHIPS.map((c) => (
            <button
              key={c.valor}
              type="button"
              role="tab"
              aria-selected={chip === c.valor}
              onClick={() => setChip(c.valor)}
              className={`chip ${chip === c.valor ? 'chip-activo' : ''}`}
            >
              {c.texto}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 md:ml-auto">
          <label className="text-xs text-t2">
            Desde{' '}
            <input
              type="date"
              value={desde}
              onChange={(e) => setDesde(e.target.value)}
              className={inputClase}
              aria-label="Desde"
            />
          </label>
          <label className="text-xs text-t2">
            Hasta{' '}
            <input
              type="date"
              value={hasta}
              onChange={(e) => setHasta(e.target.value)}
              className={inputClase}
              aria-label="Hasta"
            />
          </label>
        </div>
      </div>

      {productoId && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-t2">Producto:</span>
          <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand/15 text-brand-3 font-semibold">
            {producto.data ? `${producto.data.nombre} · ${producto.data.codigo}` : 'Cargando…'}
            <button
              type="button"
              aria-label="Quitar filtro de producto"
              onClick={() => {
                params.delete('productoId');
                setParams(params);
              }}
              className="hover:text-t1"
            >
              <X className="w-3.5 h-3.5" aria-hidden />
            </button>
          </span>
        </div>
      )}

      {rangoInvalido && (
        <Aviso tono="error">La fecha "hasta" no puede ser anterior a "desde".</Aviso>
      )}
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <section className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead className="text-xs uppercase tracking-wider text-t3 bg-fill">
            <tr>
              <th className="text-left px-5 py-3">Fecha</th>
              <th className="text-left px-3 py-3">Tipo</th>
              <th className="text-left px-3 py-3">Producto</th>
              <th className="text-right px-3 py-3">Cantidad</th>
              <th className="text-right px-3 py-3">Stock</th>
              <th className="text-left px-3 py-3">Registró</th>
              <th className="text-left px-3 py-3">Motivo</th>
              {esDuenio && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody>
            {movimientos.isPending && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-t2 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {movimientos.isError && (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-crit">
                  {mensajeDe(movimientos.error)}
                </td>
              </tr>
            )}
            {movimientos.isSuccess && items.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EstadoVacio
                    ilustracion="flechas"
                    titulo={
                      chip !== 'TODOS' || desde || hasta || productoId
                        ? 'No hay movimientos que coincidan.'
                        : 'Todavía no hay movimientos registrados.'
                    }
                    texto="Cada venta, ingreso o ajuste queda en el historial; nada se borra."
                    accion={
                      registra && (
                        <Link to={nuevoHref} className="btn btn-primary">
                          <Plus className="w-4 h-4" aria-hidden />
                          Registrar el primero
                        </Link>
                      )
                    }
                  />
                </td>
              </tr>
            )}
            {items.map((m) => {
              const anulado = m.anuladoPorId !== null;
              const esAnulacion = m.corrigeAId !== null;
              return (
                <tr key={m.id} className={`border-t border-line ${anulado ? 'opacity-50' : ''}`}>
                  <td className="px-5 py-3 whitespace-nowrap tabular-nums text-t2">
                    {formatearFechaHora(m.fecha)}
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${ETIQUETA_TIPO_CLASE[m.tipo]}`}
                    >
                      {esAnulacion ? 'Anulación' : ETIQUETA_TIPO[m.tipo]}
                    </span>
                    {anulado && (
                      <span className="ml-2 text-[11px] font-semibold text-t3 line-through">
                        Anulado
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-semibold">{m.producto.nombre}</div>
                    <div className="text-xs text-t2 font-mono">{m.producto.codigo}</div>
                  </td>
                  <td
                    className={`px-3 py-3 text-right tabular-nums font-semibold ${
                      m.efectoStock > 0 ? 'text-ok' : 'text-crit'
                    }`}
                  >
                    {formatearEfecto(m.efectoStock)}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">{m.stockResultante}</td>
                  <td className="px-3 py-3 text-t2">{m.usuario.nombre ?? '—'}</td>
                  <td className="px-3 py-3 text-t2 max-w-[220px]">
                    {m.motivo && <span>{ETIQUETA_MOTIVO[m.motivo]}</span>}
                    {m.observacion && (
                      <span className="block text-xs text-t3 truncate" title={m.observacion}>
                        {m.observacion}
                      </span>
                    )}
                    {m.tipo === 'VENTA' && m.precioUnitario && (
                      <span className="block text-xs text-t3">a ${m.precioUnitario} c/u</span>
                    )}
                  </td>
                  {esDuenio && (
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {esAnulable(m) && (
                        <button
                          type="button"
                          className="text-xs font-semibold text-crit hover:underline"
                          disabled={anular.isPending}
                          onClick={() => confirmarAnulacion(m)}
                        >
                          Anular
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {movimientos.hasNextPage && (
          <div className="p-4 border-t border-line text-center">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={movimientos.isFetchingNextPage}
              onClick={() => void movimientos.fetchNextPage()}
            >
              {movimientos.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
