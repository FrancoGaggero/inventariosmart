import {
  ETIQUETA_MOTIVO,
  ETIQUETA_TIPO,
  MOTIVOS_POR_TIPO,
  MovimientoCreateSchema,
  TIPOS_MOVIMIENTO,
  type MovimientoCreate,
  type Producto,
  type TipoMovimiento,
} from '@inventariosmart/shared';
import { ArrowLeft, Search } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { ahoraLocal, localAIso, useRegistrarMovimiento } from '@/lib/movimientos';
import { ETIQUETA_ESTADO, useProducto, useProductos } from '@/lib/productos';
import { Aviso } from '@/ui/Aviso';
import { Campo } from '@/ui/Campo';

const esTipo = (v: string | null): v is TipoMovimiento =>
  (TIPOS_MOVIMIENTO as readonly string[]).includes(v ?? '');

const AYUDA_CANTIDAD: Record<TipoMovimiento, string> = {
  VENTA: 'Unidades vendidas. Se descuentan del stock.',
  INGRESO: 'Unidades que entran. Se suman al stock.',
  AJUSTE: 'Positivo suma, negativo resta (por ejemplo −3 por rotura).',
};

const selectClase =
  'w-full rounded-xl bg-field border px-4 py-3 text-sm outline-none focus:ring-4 focus:ring-brand/15';

/** Formulario rápido de registro: /movimientos/nuevo?productoId=&tipo= (HU-10). */
export function MovimientoFormPage() {
  const [params] = useSearchParams();
  const tipoInicial = params.get('tipo');
  const [tipo, setTipo] = useState<TipoMovimiento>(esTipo(tipoInicial) ? tipoInicial : 'VENTA');
  const [productoId, setProductoId] = useState<string | undefined>(
    params.get('productoId') ?? undefined,
  );
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [cantidad, setCantidad] = useState('');
  const [fecha, setFecha] = useState(ahoraLocal);
  const [motivo, setMotivo] = useState('');
  const [observacion, setObservacion] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'warn' | 'error'; texto: string } | null>(null);

  const producto = useProducto(productoId);
  const registrar = useRegistrarMovimiento();

  useEffect(() => {
    const id = setTimeout(() => setQ(busqueda.trim()), 300);
    return () => clearTimeout(id);
  }, [busqueda]);
  const candidatos = useProductos({ q, activo: true }, 8);
  const resultados = candidatos.data?.pages[0]?.items ?? [];

  // Al cambiar el tipo, el motivo anterior puede no aplicar.
  useEffect(() => {
    setMotivo('');
    setErrores({});
  }, [tipo]);

  const elegir = (p: Producto) => {
    setProductoId(p.id);
    setBusqueda('');
    setQ('');
    setErrores((e) => ({ ...e, productoId: '' }));
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    setErrores({});

    const n = cantidad.trim() === '' ? undefined : Number(cantidad.replace(',', '.'));
    const parsed = MovimientoCreateSchema.safeParse({
      tipo,
      productoId,
      cantidad: n,
      fecha: localAIso(fecha),
      motivo: motivo || undefined,
      observacion,
    });
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const i of parsed.error.issues) e2[String(i.path[0] ?? '_')] ??= i.message;
      setErrores(e2);
      if (e2['_']) setAviso({ tono: 'error', texto: e2['_'] });
      return;
    }

    registrar.mutate(parsed.data as MovimientoCreate, {
      onSuccess: (m) => {
        const estado = ETIQUETA_ESTADO[m.estadoStock].texto;
        const base = `${ETIQUETA_TIPO[m.tipo]} registrada: ${m.producto.nombre} queda con ${m.stockResultante} unidades`;
        setAviso(
          m.estadoStock === 'OK'
            ? { tono: 'ok', texto: `${base}.` }
            : {
                tono: 'warn',
                texto: `${base} (${estado.toLowerCase()}, por debajo del stock de seguridad). Conviene reponer.`,
              },
        );
        // "Registrar otro": se conservan tipo y producto; se limpian cantidad y observación.
        setCantidad('');
        setObservacion('');
        setFecha(ahoraLocal());
      },
      onError: (err) => {
        if (err instanceof ErrorApi) {
          const details = err.error.details;
          if (
            err.status === 409 &&
            details &&
            typeof details === 'object' &&
            'stockActual' in details
          ) {
            setErrores({ cantidad: err.message });
            return;
          }
          if (err.status === 400 && details && typeof details === 'object') {
            setErrores(details as Record<string, string>);
            return;
          }
        }
        setAviso({ tono: 'error', texto: mensajeDe(err) });
      },
    });
  };

  const motivos = MOTIVOS_POR_TIPO[tipo];
  const p = producto.data;
  const estado = p ? ETIQUETA_ESTADO[p.estadoStock] : null;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to={productoId ? `/movimientos?productoId=${productoId}` : '/movimientos'}
        className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Movimientos
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Registrar movimiento</h1>
        <p className="text-t2 text-sm mt-1">
          El stock del producto se actualiza al confirmar y nunca queda negativo.
        </p>
      </header>

      <form onSubmit={onSubmit} className="card p-5 space-y-5" noValidate>
        <div role="tablist" aria-label="Tipo de movimiento" className="grid grid-cols-3 gap-2">
          {TIPOS_MOVIMIENTO.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tipo === t}
              onClick={() => setTipo(t)}
              className={`py-2.5 rounded-xl text-sm font-bold border transition ${
                tipo === t
                  ? 'bg-brand border-brand text-on-brand'
                  : 'border-line text-t2 hover:text-t1 hover:border-brand-2'
              }`}
            >
              {ETIQUETA_TIPO[t]}
            </button>
          ))}
        </div>

        <div>
          <span className="block text-xs font-semibold text-t2 mb-1.5">Producto</span>
          {p ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3">
              <div>
                <div className="font-semibold">{p.nombre}</div>
                <div className="text-xs text-t2 font-mono">{p.codigo}</div>
              </div>
              <div className="text-right whitespace-nowrap">
                <span className="font-semibold tabular-nums">{p.stockActual}</span>{' '}
                <span className="text-xs text-t2">en stock</span>{' '}
                {estado && (
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${estado.clase}`}
                  >
                    {estado.texto}
                  </span>
                )}
                <button
                  type="button"
                  className="block ml-auto mt-1 text-xs font-semibold text-brand-3 hover:underline"
                  onClick={() => setProductoId(undefined)}
                >
                  Cambiar
                </button>
              </div>
            </div>
          ) : (
            <div className="relative">
              <Search
                className="w-4 h-4 text-t3 absolute left-3 top-1/2 -translate-y-1/2"
                aria-hidden
              />
              <input
                type="search"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por código o nombre…"
                aria-label="Buscar producto"
                autoFocus
                aria-invalid={errores['productoId'] ? true : undefined}
                className={`w-full rounded-xl bg-field border pl-9 pr-4 py-3 text-sm outline-none focus:ring-4 focus:ring-brand/15 ${
                  errores['productoId']
                    ? 'border-crit/60 focus:border-crit'
                    : 'border-line focus:border-brand-2'
                }`}
              />
              {errores['productoId'] && (
                <span className="block text-xs text-crit mt-1.5">{errores['productoId']}</span>
              )}
              {(q || resultados.length > 0) && (
                <ul className="mt-2 rounded-xl border border-line divide-y divide-line overflow-hidden">
                  {candidatos.isPending && <li className="px-4 py-2 text-sm text-t2">Buscando…</li>}
                  {candidatos.isSuccess && resultados.length === 0 && (
                    <li className="px-4 py-2 text-sm text-t2">Ningún producto coincide.</li>
                  )}
                  {resultados.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => elegir(r)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-fill"
                      >
                        <span>
                          <span className="font-semibold">{r.nombre}</span>{' '}
                          <span className="text-xs text-t2 font-mono">{r.codigo}</span>
                        </span>
                        <span className="text-xs text-t2 tabular-nums whitespace-nowrap">
                          {r.stockActual} en stock
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            label="Cantidad"
            value={cantidad}
            onChange={setCantidad}
            inputMode={tipo === 'AJUSTE' ? 'text' : 'numeric'}
            placeholder={tipo === 'AJUSTE' ? '-3' : '1'}
            ayuda={AYUDA_CANTIDAD[tipo]}
            error={errores['cantidad']}
          />
          <Campo
            label="Fecha y hora"
            type="datetime-local"
            value={fecha}
            onChange={setFecha}
            max={ahoraLocal()}
            ayuda="Podés cargar movimientos de días anteriores."
            error={errores['fecha']}
          />
        </div>

        {motivos.length > 0 && (
          <label className="block">
            <span className="block text-xs font-semibold text-t2 mb-1.5">
              Motivo{tipo === 'INGRESO' && <span className="text-t3"> (opcional)</span>}
            </span>
            <select
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              aria-invalid={errores['motivo'] ? true : undefined}
              className={`${selectClase} ${
                errores['motivo']
                  ? 'border-crit/60 focus:border-crit'
                  : 'border-line focus:border-brand-2'
              }`}
            >
              <option value="">{tipo === 'AJUSTE' ? 'Elegí un motivo…' : 'Sin motivo'}</option>
              {motivos.map((m) => (
                <option key={m} value={m}>
                  {ETIQUETA_MOTIVO[m]}
                </option>
              ))}
            </select>
            {errores['motivo'] && (
              <span className="block text-xs text-crit mt-1.5">{errores['motivo']}</span>
            )}
          </label>
        )}

        <Campo
          label="Observación"
          value={observacion}
          onChange={setObservacion}
          placeholder={tipo === 'INGRESO' ? 'Remito 0001-00004512' : 'Opcional'}
          maxLength={200}
          error={errores['observacion']}
        />

        {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="submit" className="btn btn-primary" disabled={registrar.isPending}>
            {registrar.isPending
              ? 'Registrando…'
              : `Registrar ${ETIQUETA_TIPO[tipo].toLowerCase()}`}
          </button>
          <Link
            to={productoId ? `/movimientos?productoId=${productoId}` : '/movimientos'}
            className="btn btn-ghost"
          >
            {aviso?.tono === 'ok' || aviso?.tono === 'warn' ? 'Ver historial' : 'Cancelar'}
          </Link>
        </div>
      </form>
    </div>
  );
}
