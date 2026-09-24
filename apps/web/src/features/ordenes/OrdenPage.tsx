import {
  ETIQUETA_MOTIVO_NO_ENVIO,
  type ItemOrdenCreate,
  type OrdenCompra,
  OrdenPatchSchema,
  planCumple,
  subtotalItem,
  totalOrden,
} from '@inventariosmart/shared';
import { ArrowLeft, Check, Copy, Send, Trash2, Undo2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatearCalculo } from '@/lib/alertas';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import {
  CLASE_ESTADO_ORDEN,
  copiarTexto,
  etiquetaEstadoOrden,
  useCancelarOrden,
  useConfirmarOrden,
  useEditarOrden,
  useOrden,
} from '@/lib/ordenes';
import { type Producto, formatearPesos, useProductos } from '@/lib/productos';
import { useProveedores } from '@/lib/proveedores';
import { Aviso } from '@/ui/Aviso';

interface ItemEditable {
  productoId: string;
  codigo: string;
  nombre: string;
  cantidad: string;
  costoUnitarioNeto: string | null;
  alertaId: string | null;
}

function aEditables(o: OrdenCompra): ItemEditable[] {
  return o.items.map((i) => ({
    productoId: i.producto.id,
    codigo: i.producto.codigo,
    nombre: i.producto.nombre,
    cantidad: String(i.cantidad),
    costoUnitarioNeto: i.costoUnitarioNeto,
    alertaId: i.alertaId,
  }));
}

/** Detalle y edición de una orden (/ordenes/:id, HU-07 criterios 2, 3 y 4). */
export function OrdenPage() {
  const { id } = useParams<{ id: string }>();
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const tienePlan = me.data ? planCumple(me.data.plan, 'PRO') : false;
  const orden = useOrden(tienePlan ? id : undefined);
  const editar = useEditarOrden();
  const confirmar = useConfirmarOrden();
  const cancelar = useCancelarOrden();
  const navigate = useNavigate();

  const [proveedorId, setProveedorId] = useState('');
  const [items, setItems] = useState<ItemEditable[]>([]);
  const [notas, setNotas] = useState('');
  const [asunto, setAsunto] = useState('');
  const [texto, setTexto] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'warn' | 'error'; texto: string } | null>(null);

  const proveedores = useProveedores({ activo: true }, 100, esDuenio && tienePlan);
  const listaProveedores = proveedores.data?.pages.flatMap((p) => p.items) ?? [];

  useEffect(() => {
    const t = setTimeout(() => setQ(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);
  const candidatos = useProductos({ q, activo: true }, 8, q.length > 0);
  const resultados = (candidatos.data?.pages[0]?.items ?? []).filter(
    (p) => !items.some((i) => i.productoId === p.id),
  );

  const o = orden.data;
  useEffect(() => {
    if (o) {
      setProveedorId(o.proveedor.id);
      setItems(aEditables(o));
      setNotas(o.notas ?? '');
      setAsunto(o.asunto);
      setTexto(o.texto);
    }
  }, [o]);

  const esBorrador = o?.estado === 'BORRADOR';
  const editable = esBorrador && esDuenio;
  const textoCambiado = !!o && (texto !== o.texto || asunto !== o.asunto);
  const itemsCambiados =
    !!o &&
    (proveedorId !== o.proveedor.id ||
      notas !== (o.notas ?? '') ||
      JSON.stringify(items.map((i) => [i.productoId, Number(i.cantidad)])) !==
        JSON.stringify(o.items.map((i) => [i.producto.id, i.cantidad])));
  const hayCambios = textoCambiado || itemsCambiados;

  const onError = (err: unknown) => {
    if (err instanceof ErrorApi && err.status === 400 && typeof err.error.details === 'object') {
      setErrores((err.error.details ?? {}) as Record<string, string>);
    }
    setAviso({ tono: 'error', texto: mensajeDe(err) });
  };

  const armarPatch = (extra: Record<string, unknown> = {}) => {
    const itemsCreate: ItemOrdenCreate[] = items.map((i) => ({
      productoId: i.productoId,
      cantidad: Number(i.cantidad),
      alertaId: i.alertaId,
    }));
    const datos: Record<string, unknown> = { ...extra };
    if (itemsCambiados) {
      if (proveedorId !== o!.proveedor.id) datos['proveedorId'] = proveedorId;
      datos['items'] = itemsCreate;
      if (notas !== (o!.notas ?? '')) datos['notas'] = notas;
    }
    if (textoCambiado && !extra['regenerarTexto']) {
      if (texto !== o!.texto) datos['texto'] = texto;
      if (asunto !== o!.asunto) datos['asunto'] = asunto;
    }
    return datos;
  };

  const guardar = (extra: Record<string, unknown> = {}, luego?: () => void) => {
    setAviso(null);
    setErrores({});
    const parsed = OrdenPatchSchema.safeParse(armarPatch(extra));
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const i of parsed.error.issues) {
        const clave =
          i.path[0] === 'items' && i.path[1] !== undefined ? 'items' : String(i.path[0] ?? '_');
        e2[clave] ??= i.message;
      }
      setErrores(e2);
      setAviso({ tono: 'error', texto: e2['_'] ?? 'Revisá los datos marcados.' });
      return;
    }
    editar.mutate(
      { id: id!, ...parsed.data },
      {
        onSuccess: () => {
          setAviso({ tono: 'ok', texto: 'Borrador guardado.' });
          luego?.();
        },
        onError,
      },
    );
  };

  const confirmarYEnviar = () => {
    const enviar = () => {
      setAviso(null);
      confirmar.mutate(id!, {
        onSuccess: (r) =>
          setAviso(
            r.estado === 'ENVIADA'
              ? { tono: 'ok', texto: `Orden ${r.numero} enviada a ${r.enviadaA}.` }
              : {
                  tono: 'warn',
                  texto: `Orden ${r.numero} confirmada. ${r.motivoNoEnvio ? ETIQUETA_MOTIVO_NO_ENVIO[r.motivoNoEnvio] : ''}`,
                },
          ),
        onError,
      });
    };
    if (hayCambios) guardar({}, enviar);
    else enviar();
  };

  const cancelarBorrador = () => {
    if (!window.confirm(`¿Cancelar la orden ${o?.numero}? Se conserva como cancelada.`)) return;
    setAviso(null);
    cancelar.mutate(id!, {
      onSuccess: () => navigate('/ordenes'),
      onError,
    });
  };

  const copiar = async () => {
    const ok = await copiarTexto(`${o!.asunto}\n\n${o!.texto}`);
    setAviso(
      ok
        ? { tono: 'ok', texto: 'Texto copiado. Pegalo en WhatsApp o en tu correo.' }
        : { tono: 'error', texto: 'El navegador no permitió copiar. Seleccioná el texto a mano.' },
    );
  };

  const agregar = (p: Producto) => {
    setItems((xs) => [
      ...xs,
      {
        productoId: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        cantidad: '1',
        costoUnitarioNeto: null,
        alertaId: null,
      },
    ]);
    setBusqueda('');
    setQ('');
  };

  const total = totalOrden(
    items.map((i) => ({
      cantidad: Number.isInteger(Number(i.cantidad)) ? Number(i.cantidad) : 0,
      costoUnitarioNeto: i.costoUnitarioNeto,
    })),
  );
  const proveedorElegido = listaProveedores.find((p) => p.id === proveedorId) ?? o?.proveedor;
  const ocupado = editar.isPending || confirmar.isPending || cancelar.isPending;

  if (me.data && !tienePlan) {
    return (
      <div className="space-y-6">
        <Aviso tono="plan">Disponible en el plan PRO.</Aviso>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <Link to="/ordenes" className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1">
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Órdenes
      </Link>

      {orden.isError && <Aviso tono="error">{mensajeDe(orden.error)}</Aviso>}

      {o && (
        <>
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-3">
                <span className="font-mono">{o.numero}</span>
                <span
                  className={`px-2 py-0.5 rounded-md text-xs font-semibold ${CLASE_ESTADO_ORDEN[o.estado]}`}
                >
                  {etiquetaEstadoOrden(o.estado)}
                </span>
              </h1>
              <p className="text-t2 text-sm mt-1">
                {o.estado === 'ENVIADA' &&
                  `Enviada a ${o.enviadaA} el ${formatearCalculo(o.enviadaEn)} por ${o.confirmadaPor?.nombre ?? 'el dueño'}.`}
                {o.estado === 'CONFIRMADA' &&
                  `Confirmada el ${formatearCalculo(o.confirmadaEn)} por ${o.confirmadaPor?.nombre ?? 'el dueño'}.`}
                {o.estado === 'CANCELADA' && `Cancelada el ${formatearCalculo(o.canceladaEn)}.`}
                {o.estado === 'BORRADOR' &&
                  `Borrador creado el ${formatearCalculo(o.creadoEn)}. Nada se envía hasta que confirmes.`}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {!esBorrador && (
                <button type="button" className="btn btn-ghost" onClick={() => void copiar()}>
                  <Copy className="w-4 h-4" aria-hidden />
                  Copiar texto
                </button>
              )}
              {editable && (
                <>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={cancelarBorrador}
                    disabled={ocupado}
                  >
                    <X className="w-4 h-4" aria-hidden />
                    Cancelar borrador
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    onClick={() => guardar()}
                    disabled={ocupado || !hayCambios}
                  >
                    <Check className="w-4 h-4" aria-hidden />
                    Guardar
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={confirmarYEnviar}
                    disabled={ocupado}
                  >
                    <Send className="w-4 h-4" aria-hidden />
                    Confirmar y enviar
                  </button>
                </>
              )}
            </div>
          </header>

          {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
          {o.motivoNoEnvio && (
            <Aviso tono="warn">{ETIQUETA_MOTIVO_NO_ENVIO[o.motivoNoEnvio]}</Aviso>
          )}
          {editable && (
            <Aviso tono="info">
              {proveedorElegido?.email
                ? `Al confirmar se envía por correo a ${proveedorElegido.email}, con tu correo como respuesta.`
                : 'Este proveedor no tiene email: al confirmar la orden queda confirmada para que la envíes por otro medio con el texto copiado.'}
            </Aviso>
          )}

          <section className="card p-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="block text-xs font-semibold text-t2 mb-1.5">Proveedor</span>
                {editable ? (
                  <select
                    value={proveedorId}
                    onChange={(e) => setProveedorId(e.target.value)}
                    className="campo"
                  >
                    {!listaProveedores.some((p) => p.id === o.proveedor.id) && (
                      <option value={o.proveedor.id}>{o.proveedor.nombre}</option>
                    )}
                    {listaProveedores.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nombre} · lead time {p.leadTimeDias} d{p.email ? '' : ' · sin email'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm py-3">
                    {o.proveedor.nombre}
                    <span className="text-t3"> · lead time {o.proveedor.leadTimeDias} d</span>
                  </p>
                )}
                {errores['proveedorId'] && (
                  <span className="block text-xs text-crit mt-1.5">{errores['proveedorId']}</span>
                )}
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-t2 mb-1.5">Notas internas</span>
                {editable ? (
                  <input
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="No van en el correo"
                    className="campo"
                  />
                ) : (
                  <p className="text-sm py-3 text-t2">{o.notas ?? '—'}</p>
                )}
              </label>
            </div>

            <table className="w-full text-sm">
              <thead className="text-left text-xs text-t2">
                <tr>
                  <th className="py-2">Producto</th>
                  <th className="py-2 text-right">Cantidad</th>
                  <th className="py-2 text-right">Costo neto</th>
                  <th className="py-2 text-right">Subtotal</th>
                  {editable && <th className="py-2" />}
                </tr>
              </thead>
              <tbody>
                {items.map((i, idx) => (
                  <tr key={i.productoId} className="border-t border-line">
                    <td className="py-2">
                      <Link
                        to={`/productos/${i.productoId}`}
                        className="font-semibold hover:underline"
                      >
                        {i.nombre}
                      </Link>
                      <div className="text-xs text-t3 font-mono">{i.codigo}</div>
                    </td>
                    <td className="py-2 text-right">
                      {editable ? (
                        <input
                          type="number"
                          min={1}
                          step={1}
                          aria-label={`Cantidad de ${i.nombre}`}
                          value={i.cantidad}
                          onChange={(e) =>
                            setItems((xs) =>
                              xs.map((x, j) =>
                                j === idx ? { ...x, cantidad: e.target.value } : x,
                              ),
                            )
                          }
                          className="w-24 rounded-lg bg-field border border-line px-2 py-1 text-right text-sm outline-none focus:border-brand-2"
                        />
                      ) : (
                        <span className="tabular-nums">{i.cantidad}</span>
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {i.costoUnitarioNeto ? formatearPesos(i.costoUnitarioNeto) : 'a confirmar'}
                    </td>
                    <td className="py-2 text-right tabular-nums font-semibold">
                      {i.costoUnitarioNeto && Number.isInteger(Number(i.cantidad))
                        ? formatearPesos(
                            subtotalItem(Number(i.cantidad), i.costoUnitarioNeto) ?? '0',
                          )
                        : '—'}
                    </td>
                    {editable && (
                      <td className="py-2 text-right">
                        <button
                          type="button"
                          className="btn btn-ghost !py-1 !px-2 text-xs"
                          onClick={() => setItems((xs) => xs.filter((_, j) => j !== idx))}
                          aria-label={`Quitar ${i.nombre}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" aria-hidden />
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-line">
                  <td className="py-2 font-semibold" colSpan={3}>
                    Total neto estimado (sin IVA)
                  </td>
                  <td className="py-2 text-right tabular-nums font-bold">
                    {formatearPesos(total)}
                  </td>
                  {editable && <td />}
                </tr>
              </tfoot>
            </table>
            {errores['items'] && <Aviso tono="error">{errores['items']}</Aviso>}

            {editable && (
              <div className="relative">
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Agregar producto por código o nombre…"
                  aria-label="Agregar producto"
                  className="campo"
                />
                {q && resultados.length > 0 && (
                  <ul className="absolute z-10 mt-1 w-full card divide-y divide-line max-h-64 overflow-auto">
                    {resultados.map((p) => (
                      <li key={p.id}>
                        <button
                          type="button"
                          className="w-full text-left px-4 py-2 hover:bg-fill text-sm"
                          onClick={() => agregar(p)}
                        >
                          <span className="font-semibold">{p.nombre}</span>
                          <span className="text-xs text-t3 font-mono ml-2">
                            {p.codigo} · stock {p.stockActual}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            {editable && itemsCambiados && (
              <p className="text-xs text-t3">
                Los costos se actualizan con la lista vigente del proveedor al guardar.
              </p>
            )}
          </section>

          <section className="card p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold">Texto del pedido</h2>
              <div className="flex items-center gap-2">
                {o.textoEditado ? (
                  <span className="text-xs text-t3">Editado a mano</span>
                ) : (
                  <span className="text-xs text-t3">Redactado automáticamente</span>
                )}
                {editable && (o.textoEditado || textoCambiado) && (
                  <button
                    type="button"
                    className="btn btn-ghost !py-1 !px-2 text-xs"
                    onClick={() => guardar({ regenerarTexto: true })}
                    disabled={ocupado}
                  >
                    <Undo2 className="w-3.5 h-3.5" aria-hidden />
                    Volver al texto sugerido
                  </button>
                )}
              </div>
            </div>
            {editable ? (
              <>
                <input
                  value={asunto}
                  onChange={(e) => setAsunto(e.target.value)}
                  aria-label="Asunto"
                  className="campo font-semibold"
                />
                {errores['asunto'] && (
                  <span className="text-xs text-crit">{errores['asunto']}</span>
                )}
                <textarea
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  aria-label="Texto"
                  rows={14}
                  className="campo font-mono"
                />
                {errores['texto'] && <span className="text-xs text-crit">{errores['texto']}</span>}
              </>
            ) : (
              <>
                <p className="font-semibold">{o.asunto}</p>
                <pre className="whitespace-pre-wrap font-sans text-sm text-t1">{o.texto}</pre>
              </>
            )}
          </section>
        </>
      )}
    </div>
  );
}
