import {
  ETIQUETA_MOTIVO_RESUMEN,
  ETIQUETA_PERIODICIDAD,
  ETIQUETA_TIPO_GASTO,
  TIPOS_GASTO,
  mesActual,
  type Mes,
  type TipoGasto,
} from '@inventariosmart/shared';
import { Plus, Receipt } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import {
  CLASE_TIPO_GASTO,
  formatearMes,
  useEliminarGasto,
  useGastosMes,
  useResumenGastos,
} from '@/lib/gastos';
import { useMe } from '@/lib/me';
import { formatearPesos } from '@/lib/productos';
import { Aviso } from '@/ui/Aviso';
import { SelectorMes } from '@/ui/SelectorMes';

type Chip = 'TODOS' | TipoGasto;

/** Gastos operativos del mes y prorrateo por unidad vendida (HU-13). */
export function GastosPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const [periodo, setPeriodo] = useState<Mes>(mesActual());
  const [chip, setChip] = useState<Chip>('TODOS');
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  const gastos = useGastosMes(periodo, chip === 'TODOS' ? undefined : chip);
  const resumen = useResumenGastos(periodo);
  const eliminar = useEliminarGasto();
  const items = gastos.data?.items ?? [];

  const confirmarEliminar = (id: string, concepto: string) => {
    if (!window.confirm(`¿Eliminar el gasto "${concepto}"? Esta acción no se puede deshacer.`))
      return;
    setAviso(null);
    eliminar.mutate(id, {
      onSuccess: () => setAviso({ tono: 'ok', texto: `${concepto} eliminado.` }),
      onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
    });
  };

  const r = resumen.data;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Gastos operativos</h1>
          <p className="text-t2 text-sm mt-1">
            Fijos y variables, netos de IVA. Se prorratean sobre las unidades vendidas del mes
            (RN-02).
          </p>
        </div>
        {esDuenio && (
          <Link to={`/gastos/nuevo?periodo=${periodo}`} className="btn btn-primary">
            <Plus className="w-4 h-4" aria-hidden />
            Nuevo gasto
          </Link>
        )}
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <SelectorMes valor={periodo} onChange={setPeriodo} />
        <div className="flex gap-2" role="tablist" aria-label="Filtrar por tipo">
          {(
            [
              ['TODOS', 'Todos'],
              ...TIPOS_GASTO.map((t) => [t, ETIQUETA_TIPO_GASTO[t]] as const),
            ] as [Chip, string][]
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={chip === valor}
              onClick={() => setChip(valor)}
              className={`px-3 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition ${
                chip === valor
                  ? 'bg-brand border-brand text-white'
                  : 'border-white/12 text-t2 hover:text-t1 hover:border-brand-2'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      <section className="card p-5">
        <h2 className="font-bold capitalize">{formatearMes(periodo)}</h2>
        {resumen.isError ? (
          <p className="text-sm text-crit mt-2">{mensajeDe(resumen.error)}</p>
        ) : (
          <>
            <dl className="mt-3 grid gap-3 sm:grid-cols-3 text-sm">
              <div className="rounded-xl bg-white/5 p-4">
                <dt className="text-t2">Gastos del mes</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  {r ? formatearPesos(r.total) : '…'}
                </dd>
                {r && (
                  <dd className="text-xs text-t3 mt-1">
                    Fijos {formatearPesos(r.totalFijos)} · Variables{' '}
                    {formatearPesos(r.totalVariables)}
                  </dd>
                )}
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <dt className="text-t2">Unidades vendidas</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  {r?.unidadesVendidas ?? '…'}
                </dd>
                <dd className="text-xs text-t3 mt-1">Ventas del mes, sin las anuladas</dd>
              </div>
              <div className="rounded-xl bg-white/5 p-4">
                <dt className="text-t2">Gasto por unidad vendida</dt>
                <dd className="text-xl font-extrabold tabular-nums">
                  {r ? (r.gastoPorUnidad ? formatearPesos(r.gastoPorUnidad) : '—') : '…'}
                </dd>
                <dd className="text-xs text-t3 mt-1">Se resta del margen bruto (RN-02)</dd>
              </div>
            </dl>
            {r?.motivo && (
              <div className="mt-3">
                <Aviso tono="warn">{ETIQUETA_MOTIVO_RESUMEN[r.motivo]}</Aviso>
              </div>
            )}
          </>
        )}
      </section>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <section className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-xs uppercase tracking-wider text-t3 bg-white/[0.03]">
            <tr>
              <th className="text-left px-5 py-3">Concepto</th>
              <th className="text-left px-3 py-3">Tipo</th>
              <th className="text-left px-3 py-3">Periodicidad</th>
              <th className="text-right px-3 py-3">Importe del mes</th>
              {esDuenio && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody>
            {gastos.isPending && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-t2 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {gastos.isError && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-crit">
                  {mensajeDe(gastos.error)}
                </td>
              </tr>
            )}
            {gastos.isSuccess && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-t2">
                  <Receipt className="w-8 h-8 mx-auto mb-2 text-t3" aria-hidden />
                  No hay gastos cargados para este mes.
                  {esDuenio && (
                    <>
                      {' '}
                      <Link
                        to={`/gastos/nuevo?periodo=${periodo}`}
                        className="text-brand-3 font-semibold"
                      >
                        Cargá el primero
                      </Link>
                      .
                    </>
                  )}
                </td>
              </tr>
            )}
            {items.map((g) => (
              <tr key={g.id} className="border-t border-white/6">
                <td className="px-5 py-3">
                  <div className="font-semibold">
                    {esDuenio ? (
                      <Link to={`/gastos/${g.id}`} className="hover:text-brand-3">
                        {g.concepto}
                      </Link>
                    ) : (
                      g.concepto
                    )}
                  </div>
                  {g.notas && <div className="text-xs text-t3 truncate max-w-xs">{g.notas}</div>}
                </td>
                <td className="px-3 py-3">
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CLASE_TIPO_GASTO[g.tipo]}`}
                  >
                    {ETIQUETA_TIPO_GASTO[g.tipo]}
                  </span>
                </td>
                <td className="px-3 py-3 text-t2">
                  {ETIQUETA_PERIODICIDAD[g.periodicidad]}
                  {g.periodicidad !== 'UNICO' && (
                    <span className="block text-xs text-t3">
                      desde {g.periodo}
                      {g.fin ? ` hasta ${g.fin}` : ''}
                      {g.periodicidad === 'ANUAL' ? ` · ${formatearPesos(g.importe)} al año` : ''}
                    </span>
                  )}
                </td>
                <td className="px-3 py-3 text-right tabular-nums font-semibold">
                  {formatearPesos(g.importeMes)}
                </td>
                {esDuenio && (
                  <td className="px-5 py-3 text-right whitespace-nowrap space-x-3">
                    <Link
                      to={`/gastos/${g.id}`}
                      className="text-xs font-semibold text-brand-3 hover:underline"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      className="text-xs font-semibold text-crit hover:underline"
                      disabled={eliminar.isPending}
                      onClick={() => confirmarEliminar(g.id, g.concepto)}
                    >
                      Eliminar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {gastos.data && items.length > 0 && (
            <tfoot className="text-sm font-bold bg-white/[0.03]">
              <tr>
                <td className="px-5 py-3" colSpan={3}>
                  Total del mes
                  <span className="block text-xs font-normal text-t3">
                    Fijos {formatearPesos(gastos.data.totales.fijos)} · Variables{' '}
                    {formatearPesos(gastos.data.totales.variables)}
                  </span>
                </td>
                <td className="px-3 py-3 text-right tabular-nums">
                  {formatearPesos(gastos.data.totales.total)}
                </td>
                {esDuenio && <td />}
              </tr>
            </tfoot>
          )}
        </table>
      </section>
    </div>
  );
}
