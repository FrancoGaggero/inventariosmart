import { ETIQUETA_ORIGEN, PreciosCreateSchema, type Producto } from '@inventariosmart/shared';
import { ArrowLeft, FileSpreadsheet, Pencil, Plus, Search } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { formatearPesos, useProductos } from '@/lib/productos';
import {
  estrellas,
  formatearFecha,
  useCargarPrecios,
  usePreciosProveedor,
  useProveedor,
} from '@/lib/proveedores';
import { Aviso } from '@/ui/Aviso';
import { Campo } from '@/ui/Campo';

/** Ficha del proveedor: datos, lista vigente, carga manual e importación (HU-02). */
export function ProveedorDetallePage() {
  const { id } = useParams<{ id: string }>();
  const proveedor = useProveedor(id);
  const precios = usePreciosProveedor(id);
  const items = precios.data?.pages.flatMap((p) => p.items) ?? [];
  const [cargando, setCargando] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  if (proveedor.isError) return <Aviso tono="error">{mensajeDe(proveedor.error)}</Aviso>;
  const p = proveedor.data;

  return (
    <div className="space-y-6">
      <Link
        to="/proveedores"
        className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Proveedores
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">
            {p?.nombre ?? 'Cargando…'}
            {p && !p.activo && (
              <span className="ml-3 align-middle text-[11px] font-bold px-2 py-0.5 rounded-full bg-crit/15 text-crit">
                Dado de baja
              </span>
            )}
          </h1>
          {p && (
            <dl className="mt-2 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-2 text-t2">
              {p.contacto && (
                <div>
                  <dt className="inline text-t3">Contacto: </dt>
                  <dd className="inline text-t1">{p.contacto}</dd>
                </div>
              )}
              {p.email && (
                <div>
                  <dt className="inline text-t3">Email: </dt>
                  <dd className="inline text-t1">{p.email}</dd>
                </div>
              )}
              {p.telefono && (
                <div>
                  <dt className="inline text-t3">Teléfono: </dt>
                  <dd className="inline text-t1">{p.telefono}</dd>
                </div>
              )}
              {p.cuit && (
                <div>
                  <dt className="inline text-t3">CUIT: </dt>
                  <dd className="inline text-t1 font-mono">{p.cuit}</dd>
                </div>
              )}
              <div>
                <dt className="inline text-t3">Entrega: </dt>
                <dd className="inline text-t1">{p.leadTimeDias} días</dd>
              </div>
              <div>
                <dt className="inline text-t3">Confiabilidad: </dt>
                <dd className="inline text-warn tracking-wider">{estrellas(p.confiabilidad)}</dd>
              </div>
              {p.notas && <div className="sm:col-span-2 text-t2">{p.notas}</div>}
            </dl>
          )}
        </div>
        {p && (
          <div className="flex flex-wrap gap-2">
            <Link to={`/proveedores/${p.id}/editar`} className="btn btn-ghost">
              <Pencil className="w-4 h-4" aria-hidden />
              Editar
            </Link>
            {p.activo && (
              <>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setCargando((c) => !c)}
                  aria-expanded={cargando}
                >
                  <Plus className="w-4 h-4" aria-hidden />
                  Cargar costo
                </button>
                <Link to={`/proveedores/${p.id}/importar`} className="btn btn-primary">
                  <FileSpreadsheet className="w-4 h-4" aria-hidden />
                  Importar lista
                </Link>
              </>
            )}
          </div>
        )}
      </header>

      {cargando && id && (
        <CargaManual
          proveedorId={id}
          onListo={(texto) => {
            setAviso({ tono: 'ok', texto });
            setCargando(false);
          }}
          onError={(texto) => setAviso({ tono: 'error', texto })}
        />
      )}
      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <section className="space-y-3">
        <h2 className="font-bold">Lista de precios vigente</h2>
        <p className="text-t2 text-sm">
          Último costo neto informado por producto. Si este es el proveedor principal del producto,
          ese costo es el que usa el sistema.
        </p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead className="text-xs uppercase tracking-wider text-t3 bg-fill">
              <tr>
                <th className="text-left px-5 py-3">Producto</th>
                <th className="text-right px-3 py-3">Costo neto</th>
                <th className="text-left px-3 py-3">Vigente desde</th>
                <th className="text-left px-5 py-3">Origen</th>
              </tr>
            </thead>
            <tbody>
              {precios.isPending && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-t2 text-center">
                    Cargando…
                  </td>
                </tr>
              )}
              {precios.isError && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-crit">
                    {mensajeDe(precios.error)}
                  </td>
                </tr>
              )}
              {precios.isSuccess && items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-10 text-center text-t2">
                    Este proveedor todavía no tiene costos cargados.
                  </td>
                </tr>
              )}
              {items.map((f) => (
                <tr key={f.id} className="border-t border-line">
                  <td className="px-5 py-3">
                    <div className="font-semibold">{f.producto.nombre}</div>
                    <div className="text-xs text-t2 font-mono">{f.producto.codigo}</div>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatearPesos(f.costoNeto)}
                  </td>
                  <td className="px-3 py-3 text-t2 whitespace-nowrap">
                    {formatearFecha(f.vigenteDesde)}
                  </td>
                  <td className="px-5 py-3 text-t2">{ETIQUETA_ORIGEN[f.origen]}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {precios.hasNextPage && (
            <div className="p-4 border-t border-line text-center">
              <button
                type="button"
                className="btn btn-ghost"
                disabled={precios.isFetchingNextPage}
                onClick={() => void precios.fetchNextPage()}
              >
                {precios.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

/** Formulario inline: buscar un producto y cargarle un costo neto. */
function CargaManual({
  proveedorId,
  onListo,
  onError,
}: {
  proveedorId: string;
  onListo: (texto: string) => void;
  onError: (texto: string) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState('');
  const [producto, setProducto] = useState<Producto | null>(null);
  const [costo, setCosto] = useState('');
  const [error, setError] = useState<string | undefined>();
  const cargar = useCargarPrecios(proveedorId);

  useEffect(() => {
    const t = setTimeout(() => setQ(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);
  const candidatos = useProductos({ q, activo: true }, 8, producto === null);
  const resultados = candidatos.data?.pages[0]?.items ?? [];

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    const parsed = PreciosCreateSchema.safeParse({
      items: [{ productoId: producto?.id, costoNeto: costo }],
    });
    if (!parsed.success) {
      const issue = parsed.error.issues[0];
      setError(issue?.message ?? 'Revisá los datos.');
      return;
    }
    cargar.mutate(parsed.data, {
      onSuccess: (r) => {
        const cambio = r.productosActualizados > 0 ? ' y ahora es su costo vigente' : '';
        onListo(`Costo de ${producto!.nombre} cargado${cambio}.`);
      },
      onError: (err) => onError(err instanceof ErrorApi ? err.message : mensajeDe(err)),
    });
  };

  return (
    <form onSubmit={onSubmit} className="card p-5 space-y-4" noValidate>
      <h2 className="font-bold">Cargar costo a mano</h2>
      {producto ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-brand/40 bg-brand/10 px-4 py-3 text-sm">
          <div>
            <div className="font-semibold">{producto.nombre}</div>
            <div className="text-xs text-t2 font-mono">
              {producto.codigo} · costo vigente {formatearPesos(producto.costoReposicion)}
            </div>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-brand-3 hover:underline"
            onClick={() => setProducto(null)}
          >
            Cambiar
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search className="w-4 h-4 text-t3 absolute left-3 top-3.5" aria-hidden />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar producto por código o nombre…"
            aria-label="Buscar producto"
            autoFocus
            className="w-full rounded-xl bg-field border border-line pl-9 pr-4 py-3 text-sm outline-none focus:border-brand-2 focus:ring-4 focus:ring-brand/15"
          />
          {q && (
            <ul className="mt-2 rounded-xl border border-line divide-y divide-line overflow-hidden">
              {candidatos.isSuccess && resultados.length === 0 && (
                <li className="px-4 py-2 text-sm text-t2">Ningún producto coincide.</li>
              )}
              {resultados.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setProducto(r)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-2.5 text-left text-sm hover:bg-fill"
                  >
                    <span>
                      <span className="font-semibold">{r.nombre}</span>{' '}
                      <span className="text-xs text-t2 font-mono">{r.codigo}</span>
                    </span>
                    <span className="text-xs text-t2 whitespace-nowrap">
                      costo {formatearPesos(r.costoReposicion)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 items-end">
        <Campo
          label="Costo neto ($, sin IVA)"
          value={costo}
          onChange={setCosto}
          inputMode="decimal"
          placeholder="2340"
          error={error}
        />
        <div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={cargar.isPending || !producto}
          >
            {cargar.isPending ? 'Guardando…' : 'Guardar costo'}
          </button>
        </div>
      </div>
    </form>
  );
}
