import {
  CRITERIOS_REMARCACION,
  ESTADOS_PRECIO,
  ETIQUETA_CRITERIO,
  ETIQUETA_ESTADO_PRECIO,
  ETIQUETA_REDONDEO,
  MesSchema,
  margenBrutoPct,
  planCumple,
  REDONDEOS,
  type CriterioRemarcacion,
  type EstadoPrecio,
  type ItemRemarcacion,
  type ProductoCambiado,
  type Redondeo,
} from '@inventariosmart/shared';
import { ArrowLeft, Check, RefreshCw, Tags } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { formatearMes } from '@/lib/gastos';
import { CLASE_ESTADO_PRECIO } from '@/lib/inflacion';
import { useMe } from '@/lib/me';
import { formatearPesos } from '@/lib/productos';
import {
  armarPedido,
  filasAplicables,
  formatearCambio,
  fraseResumen,
  precioFinal,
  useAplicarRemarcacion,
  useVistaPrevia,
  type FormularioRemarcacion,
} from '@/lib/remarcacion';
import { formatearPct } from '@/lib/rentabilidad';
import { Aviso } from '@/ui/Aviso';
import { Confirmar } from '@/ui/Confirmar';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';

const PAGINA = 50;

const AYUDA_CRITERIO: Record<CriterioRemarcacion, string> = {
  INFLACION: 'Lleva cada precio a donde estaría si hubiera acompañado a la inflación del período.',
  MARGEN: 'Sube cada precio lo mismo que subió su costo, para sostener el margen que tenías.',
  PORCENTAJE: 'Suma el mismo porcentaje a todos los precios.',
  MARGEN_OBJETIVO: 'Calcula el precio desde el costo para que cada producto deje ese margen.',
};

const mesValido = (texto: string | null) => {
  const r = MesSchema.safeParse(texto);
  return r.success ? r.data : null;
};

/** Asistente de remarcación (/remarcar, HU-17). DUENIO aplica; CONTADOR sólo mira. */
export function RemarcarPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const [parametros] = useSearchParams();

  const estadoInicial = ESTADOS_PRECIO.find((e) => e === parametros.get('estado')) ?? null;
  const criterioInicial =
    CRITERIOS_REMARCACION.find((c) => c === parametros.get('criterio')) ?? 'INFLACION';
  const [f, setF] = useState<FormularioRemarcacion>({
    criterio: criterioInicial,
    porcentaje: '10',
    margen: '35',
    redondeo: 'NINGUNO',
    permitirBajas: false,
    estado: estadoInicial,
    desde: mesValido(parametros.get('desde')),
    hasta: mesValido(parametros.get('hasta')),
  });
  const [quitados, setQuitados] = useState<ReadonlySet<string>>(new Set());
  const [ajustes, setAjustes] = useState<Readonly<Record<string, string>>>({});
  const [visibles, setVisibles] = useState(PAGINA);
  const [confirmar, setConfirmar] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);
  const [aplicado, setAplicado] = useState<{ cantidad: number } | null>(null);
  const [cambiados, setCambiados] = useState<ProductoCambiado[]>([]);

  const cambiar = (cambio: Partial<FormularioRemarcacion>) => {
    setF((s) => ({ ...s, ...cambio }));
    // Otro criterio da otros precios: los ajustes a mano dejan de tener sentido.
    setAjustes({});
    setQuitados(new Set());
    setVisibles(PAGINA);
    setAviso(null);
    setAplicado(null);
    setCambiados([]);
  };

  const { pedido, error: errorPedido } = useMemo(() => armarPedido(f), [f]);
  const previa = useVistaPrevia(pedido, tienePlan);
  const aplicar = useAplicarRemarcacion();
  const v = pedido ? previa.data : undefined;
  const items: ItemRemarcacion[] = v?.items ?? [];
  const filas = filasAplicables(items, quitados, ajustes);
  const conError = items.filter(
    (i) => !quitados.has(i.producto.id) && precioFinal(i, ajustes[i.producto.id]).error !== null,
  ).length;

  const confirmarAplicar = () => {
    if (!v) return;
    setAviso(null);
    setCambiados([]);
    aplicar.mutate(
      { criterio: v.criterio, parametros: v.parametros, items: filas },
      {
        onSuccess: (lote) => {
          setConfirmar(false);
          setAplicado({ cantidad: lote.cantidad });
          setAjustes({});
          setQuitados(new Set());
        },
        onError: (err) => {
          setConfirmar(false);
          if (err instanceof ErrorApi && err.status === 409) {
            const detalle = err.error.details as { productos?: ProductoCambiado[] } | undefined;
            setCambiados(detalle?.productos ?? []);
          }
          setAviso({ tono: 'error', texto: mensajeDe(err) });
        },
      },
    );
  };

  const alternar = (id: string) =>
    setQuitados((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const campoPrecio = (i: ItemRemarcacion) => {
    const { error } = precioFinal(i, ajustes[i.producto.id]);
    const quitado = quitados.has(i.producto.id);
    if (!esDuenio) {
      return (
        <span className="tabular-nums font-semibold">
          {i.precioNuevo === null ? '—' : formatearPesos(i.precioNuevo)}
        </span>
      );
    }
    return (
      <>
        <input
          inputMode="decimal"
          aria-label={`Precio nuevo de ${i.producto.nombre}`}
          aria-invalid={error ? true : undefined}
          disabled={quitado}
          value={ajustes[i.producto.id] ?? i.precioNuevo?.replace('.', ',') ?? ''}
          placeholder={i.precioNuevo === null ? 'Sin calcular' : undefined}
          onChange={(e) => setAjustes((s) => ({ ...s, [i.producto.id]: e.target.value }))}
          className={`w-28 rounded-lg bg-field border px-2 py-1 text-right text-sm tabular-nums outline-none focus:border-brand-2 disabled:opacity-50 ${
            error ? 'border-crit/60' : 'border-line'
          }`}
        />
        {error && <span className="block text-[11px] text-crit mt-1">{error}</span>}
      </>
    );
  };

  /** Margen con el precio que se va a aplicar: el ajustado a mano o el calculado. */
  const margenDe = (i: ItemRemarcacion) => {
    if (ajustes[i.producto.id] === undefined) return i.margenBrutoPctNuevo;
    const { precio } = precioFinal(i, ajustes[i.producto.id]);
    return precio === null ? null : margenBrutoPct(precio, i.costo, i.alicuotaIva);
  };

  const cambioDe = (i: ItemRemarcacion) => {
    const { precio } = precioFinal(i, ajustes[i.producto.id]);
    if (ajustes[i.producto.id] === undefined) return formatearCambio(i.variacion);
    if (precio === null) return '0 %';
    return formatearCambio(
      (((Number(precio) - Number(i.precioActual)) / Number(i.precioActual)) * 100).toFixed(2),
    );
  };

  if (me.data && !tienePlan) {
    return (
      <Aviso tono="plan">
        Disponible en el plan PRO: remarcá todos tus precios en un paso, con vista previa y la
        posibilidad de deshacer.
      </Aviso>
    );
  }

  const pagina = items.slice(0, visibles);

  return (
    <div className="space-y-6">
      <Link
        to="/inflacion"
        className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Precios e inflación
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Tags className="w-6 h-6 text-brand-3 shrink-0" aria-hidden />
            Remarcar precios
          </h1>
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            {errorPedido
              ? errorPedido
              : previa.isError
                ? mensajeDe(previa.error)
                : v
                  ? fraseResumen(v.resumen)
                  : 'Calculando los precios nuevos…'}
          </p>
        </div>
        <Link to="/remarcaciones" className="btn btn-ghost">
          Ver remarcaciones
        </Link>
      </header>

      {aplicado && (
        <Aviso tono="ok">
          Listo:{' '}
          {aplicado.cantidad === 1
            ? 'se remarcó 1 producto'
            : `se remarcaron ${aplicado.cantidad} productos`}
          . Si te equivocaste, podés deshacerlo desde{' '}
          <Link to="/remarcaciones" className="font-semibold underline">
            Remarcaciones
          </Link>
          .
        </Aviso>
      )}
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
      {cambiados.length > 0 && (
        <div className="card p-4 space-y-2">
          <p className="text-sm font-semibold">Estos precios cambiaron mientras revisabas:</p>
          <ul className="text-sm text-t2 space-y-1">
            {cambiados.slice(0, 10).map((p) => (
              <li key={p.productoId}>
                <span className="font-mono text-xs text-t3">{p.codigo}</span> {p.nombre}: ahora{' '}
                <b className="text-t1">{formatearPesos(p.precioActual)}</b>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              setCambiados([]);
              setAviso(null);
              setAjustes({});
              void previa.refetch();
            }}
          >
            <RefreshCw className="w-4 h-4" aria-hidden />
            Volver a calcular
          </button>
        </div>
      )}
      {v?.motivo === 'SIN_IPC' && (
        <Aviso tono="warn">
          Todavía no tenemos el índice de precios del INDEC para ese período: elegí otro criterio o
          probá más tarde.
        </Aviso>
      )}

      <section className="card p-4 sm:p-5 space-y-4" aria-label="Criterio de remarcación">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Criterio">
          {CRITERIOS_REMARCACION.map((c) => (
            <button
              key={c}
              type="button"
              className={`chip ${f.criterio === c ? 'chip-activo' : ''}`}
              aria-pressed={f.criterio === c}
              onClick={() => cambiar({ criterio: c })}
            >
              {ETIQUETA_CRITERIO[c]}
            </button>
          ))}
        </div>
        <p className="text-sm text-t2">
          {AYUDA_CRITERIO[f.criterio]}
          {v?.parametros.desde && v.parametros.hasta && f.criterio !== 'MARGEN_OBJETIVO' && (
            <span className="text-t3">
              {' '}
              Período: {formatearMes(v.parametros.desde)} a {formatearMes(v.parametros.hasta)}.
            </span>
          )}
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {f.criterio === 'PORCENTAJE' && (
            <label className="block">
              <span className="block text-xs font-semibold text-t2 mb-1.5">Porcentaje</span>
              <input
                inputMode="decimal"
                value={f.porcentaje}
                onChange={(e) => cambiar({ porcentaje: e.target.value })}
                className="campo"
                placeholder="10"
              />
            </label>
          )}
          {f.criterio === 'MARGEN_OBJETIVO' && (
            <label className="block">
              <span className="block text-xs font-semibold text-t2 mb-1.5">
                Margen bruto objetivo (%)
              </span>
              <input
                inputMode="decimal"
                value={f.margen}
                onChange={(e) => cambiar({ margen: e.target.value })}
                className="campo"
                placeholder="35"
              />
            </label>
          )}
          <label className="block">
            <span className="block text-xs font-semibold text-t2 mb-1.5">Redondeo</span>
            <select
              value={f.redondeo}
              onChange={(e) => cambiar({ redondeo: e.target.value as Redondeo })}
              className="campo"
            >
              {REDONDEOS.map((r) => (
                <option key={r} value={r}>
                  {ETIQUETA_REDONDEO[r]}
                  {r === 'NINGUNO' ? '' : ' (hacia arriba)'}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-semibold text-t2 mb-1.5">Productos</span>
            <select
              value={f.estado ?? ''}
              onChange={(e) =>
                cambiar({ estado: e.target.value === '' ? null : (e.target.value as EstadoPrecio) })
              }
              className="campo"
            >
              <option value="">Todos los activos</option>
              {ESTADOS_PRECIO.map((e) => (
                <option key={e} value={e}>
                  Sólo los {ETIQUETA_ESTADO_PRECIO[e].toLowerCase()}s
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm sm:self-end sm:pb-3">
            <input
              type="checkbox"
              checked={f.permitirBajas}
              onChange={(e) => cambiar({ permitirBajas: e.target.checked })}
              className="w-4 h-4 accent-[var(--color-brand-2)]"
            />
            Permitir que bajen precios
          </label>
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="titulo-previa">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="titulo-previa" className="font-bold">
              Vista previa
            </h2>
            <p className="text-xs text-t2 max-w-2xl">
              Nada cambia hasta que apliques.
              {esDuenio &&
                ' Podés ajustar un precio a mano o destildar un producto para dejarlo afuera.'}
            </p>
          </div>
          {esDuenio && (
            <button
              type="button"
              className="btn btn-primary"
              disabled={
                filas.length === 0 || conError > 0 || aplicar.isPending || previa.isFetching
              }
              onClick={() => setConfirmar(true)}
            >
              <Check className="w-4 h-4" aria-hidden />
              {filas.length === 1 ? 'Aplicar a 1 producto' : `Aplicar a ${filas.length} productos`}
            </button>
          )}
        </div>

        <div className="card overflow-hidden">
          {pedido && previa.isPending && <SkeletonFilas filas={5} />}
          {v && items.length === 0 && (
            <EstadoVacio
              ilustracion="cajas"
              titulo="No hay productos para remarcar."
              texto="Probá con otro criterio o con todos los productos activos."
            />
          )}
          {pagina.length > 0 && (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-t2 text-left">
                    <tr className="border-b border-line">
                      {esDuenio && <th scope="col" className="px-4 py-3 w-8" />}
                      <th scope="col" className="font-semibold px-3 py-3">
                        Producto
                      </th>
                      <th scope="col" className="font-semibold px-3 py-3 text-right">
                        Precio actual
                      </th>
                      <th scope="col" className="font-semibold px-3 py-3 text-right">
                        Precio nuevo
                      </th>
                      <th scope="col" className="font-semibold px-3 py-3 text-right">
                        Cambio
                      </th>
                      <th
                        scope="col"
                        className="font-semibold px-4 py-3 text-right hidden lg:table-cell"
                      >
                        Margen bruto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagina.map((i) => {
                      const quitado = quitados.has(i.producto.id);
                      return (
                        <tr
                          key={i.producto.id}
                          className={`border-b border-line last:border-0 ${quitado ? 'opacity-50' : ''}`}
                        >
                          {esDuenio && (
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={!quitado}
                                onChange={() => alternar(i.producto.id)}
                                aria-label={`Incluir ${i.producto.nombre}`}
                                className="w-4 h-4 accent-[var(--color-brand-2)]"
                              />
                            </td>
                          )}
                          <th scope="row" className="px-3 py-3 text-left font-normal">
                            <span className="font-semibold">{i.producto.nombre}</span>
                            <div className="text-xs text-t3 font-mono flex items-center gap-2">
                              {i.producto.codigo}
                              {i.estado && (
                                <span
                                  className={`px-1.5 py-0.5 rounded-full font-sans font-bold text-[10px] ${CLASE_ESTADO_PRECIO[i.estado]}`}
                                >
                                  {ETIQUETA_ESTADO_PRECIO[i.estado]}
                                </span>
                              )}
                            </div>
                          </th>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                            {formatearPesos(i.precioActual)}
                          </td>
                          <td className="px-3 py-3 text-right whitespace-nowrap">
                            {campoPrecio(i)}
                          </td>
                          <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap font-semibold">
                            {i.resultado === 'SIN_DATOS' && ajustes[i.producto.id] === undefined
                              ? 'Sin datos'
                              : cambioDe(i)}
                          </td>
                          <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap hidden lg:table-cell text-t2">
                            {formatearPct(i.margenBrutoPctActual)}
                            {margenDe(i) !== null && margenDe(i) !== i.margenBrutoPctActual && (
                              <>
                                {' → '}
                                <b className="text-t1">{formatearPct(margenDe(i))}</b>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <ul className="md:hidden divide-y divide-line">
                {pagina.map((i) => {
                  const quitado = quitados.has(i.producto.id);
                  return (
                    <li
                      key={i.producto.id}
                      className={`p-4 space-y-2 ${quitado ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-start gap-3">
                        {esDuenio && (
                          <input
                            type="checkbox"
                            checked={!quitado}
                            onChange={() => alternar(i.producto.id)}
                            aria-label={`Incluir ${i.producto.nombre}`}
                            className="w-4 h-4 mt-1 accent-[var(--color-brand-2)]"
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="font-semibold block truncate">{i.producto.nombre}</span>
                          <span className="text-xs text-t3 font-mono">{i.producto.codigo}</span>
                        </div>
                        <span className="text-sm font-semibold tabular-nums whitespace-nowrap">
                          {i.resultado === 'SIN_DATOS' && ajustes[i.producto.id] === undefined
                            ? 'Sin datos'
                            : cambioDe(i)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="text-t2 tabular-nums">
                          Hoy {formatearPesos(i.precioActual)}
                        </span>
                        <span className="text-right">{campoPrecio(i)}</span>
                      </div>
                      <p className="text-xs text-t3 tabular-nums">
                        Margen bruto {formatearPct(i.margenBrutoPctActual)}
                        {margenDe(i) !== null &&
                          margenDe(i) !== i.margenBrutoPctActual &&
                          ` → ${formatearPct(margenDe(i))}`}
                      </p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>

        {items.length > visibles && (
          <div className="text-center">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setVisibles((n) => n + PAGINA)}
            >
              Ver más ({items.length - visibles} restantes)
            </button>
          </div>
        )}
      </section>

      <Confirmar
        abierto={confirmar}
        titulo={
          filas.length === 1 ? '¿Remarcar 1 producto?' : `¿Remarcar ${filas.length} productos?`
        }
        textoConfirmar="Aplicar"
        textoCancelar="Seguir revisando"
        ocupado={aplicar.isPending}
        onConfirmar={confirmarAplicar}
        onCancelar={() => setConfirmar(false)}
      >
        Los precios nuevos quedan vigentes en el momento para las próximas ventas. Si te
        equivocaste, podés deshacer la remarcación desde Remarcaciones.
      </Confirmar>
    </div>
  );
}
