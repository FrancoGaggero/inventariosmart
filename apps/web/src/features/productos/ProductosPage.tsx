import type { EstadoStock } from '@inventariosmart/shared';
import { Package, Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import {
  ETIQUETA_ESTADO,
  formatearPesos,
  type Producto,
  useActualizarProducto,
  useDarDeBajaProducto,
  useProductos,
} from '@/lib/productos';
import { Aviso } from '@/ui/Aviso';

type Chip = 'TODOS' | EstadoStock | 'BAJAS';

const CHIPS: { valor: Chip; texto: string }[] = [
  { valor: 'TODOS', texto: 'Todos' },
  { valor: 'OK', texto: 'OK' },
  { valor: 'BAJO', texto: 'Bajo' },
  { valor: 'SIN_STOCK', texto: 'Sin stock' },
  { valor: 'BAJAS', texto: 'Dados de baja' },
];

export function ProductosPage() {
  const me = useMe();
  const esDuenio = me.data?.rol === 'DUENIO';
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<Chip>('TODOS');
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error' | 'plan'; texto: string } | null>(null);

  // Debounce del buscador: consulta 300 ms después de la última tecla.
  useEffect(() => {
    const id = setTimeout(() => setQ(texto.trim()), 300);
    return () => clearTimeout(id);
  }, [texto]);

  const filtros = {
    q,
    estado: chip === 'TODOS' || chip === 'BAJAS' ? undefined : chip,
    activo: chip !== 'BAJAS',
  };
  const productos = useProductos(filtros);
  const baja = useDarDeBajaProducto();
  const actualizar = useActualizarProducto();

  const items = productos.data?.pages.flatMap((p) => p.items) ?? [];

  const darDeBaja = (p: Producto) => {
    if (!window.confirm(`¿Dar de baja "${p.nombre}"? Se conserva su código y su historial.`))
      return;
    setAviso(null);
    baja.mutate(p.id, {
      onSuccess: () => setAviso({ tono: 'ok', texto: `${p.nombre} dado de baja.` }),
      onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
    });
  };

  const reactivar = (p: Producto) => {
    setAviso(null);
    actualizar.mutate(
      { id: p.id, activo: true },
      {
        onSuccess: () => setAviso({ tono: 'ok', texto: `${p.nombre} reactivado.` }),
        onError: (err) => {
          const e = err as { status?: number };
          setAviso({
            tono: e.status === 402 ? 'plan' : 'error',
            texto:
              e.status === 402 ? `Disponible en el plan PRO. ${mensajeDe(err)}` : mensajeDe(err),
          });
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Inventario</h1>
          <p className="text-t2 text-sm mt-1">
            {esDuenio
              ? 'Tu catálogo con precios, costos y stock.'
              : 'Catálogo y stock. Los costos los ve el dueño.'}
          </p>
        </div>
        {esDuenio && (
          <Link to="/productos/nuevo" className="btn btn-primary">
            <Plus className="w-4 h-4" aria-hidden />
            Nuevo producto
          </Link>
        )}
      </header>

      <div className="flex flex-col md:flex-row gap-3">
        <label className="relative flex-1">
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
            className="w-full rounded-xl bg-[#070C16] border border-white/12 pl-9 pr-4 py-2.5 text-sm outline-none focus:border-brand-2 focus:ring-4 focus:ring-brand/15"
          />
        </label>
        <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Filtrar por estado">
          {CHIPS.map((c) => (
            <button
              key={c.valor}
              type="button"
              role="tab"
              aria-selected={chip === c.valor}
              onClick={() => setChip(c.valor)}
              className={`px-3 py-2 rounded-full text-xs font-semibold border whitespace-nowrap transition ${
                chip === c.valor
                  ? 'bg-brand border-brand text-white'
                  : 'border-white/12 text-t2 hover:text-t1 hover:border-brand-2'
              }`}
            >
              {c.texto}
            </button>
          ))}
        </div>
      </div>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <section className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-xs uppercase tracking-wider text-t3 bg-white/[0.03]">
            <tr>
              <th className="text-left px-5 py-3">Producto</th>
              <th className="text-right px-3 py-3">Stock</th>
              <th className="text-right px-3 py-3">Precio</th>
              {esDuenio && <th className="text-right px-3 py-3">Costo</th>}
              {esDuenio && <th className="px-5 py-3" />}
            </tr>
          </thead>
          <tbody>
            {productos.isPending && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-t2 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {productos.isError && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-crit">
                  {mensajeDe(productos.error)}
                </td>
              </tr>
            )}
            {productos.isSuccess && items.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-10 text-center text-t2">
                  <Package className="w-8 h-8 mx-auto mb-2 text-t3" aria-hidden />
                  {q || chip !== 'TODOS'
                    ? 'No hay productos que coincidan.'
                    : 'Todavía no cargaste productos.'}
                  {esDuenio && !q && chip === 'TODOS' && (
                    <>
                      {' '}
                      <Link to="/productos/nuevo" className="text-brand-3 font-semibold">
                        Cargá el primero
                      </Link>
                      .
                    </>
                  )}
                </td>
              </tr>
            )}
            {items.map((p) => {
              const estado = ETIQUETA_ESTADO[p.estadoStock];
              return (
                <tr
                  key={p.id}
                  className={`border-t border-white/6 ${p.activo ? '' : 'opacity-60'}`}
                >
                  <td className="px-5 py-3">
                    <div className="font-semibold">
                      {esDuenio ? (
                        <Link to={`/productos/${p.id}`} className="hover:text-brand-3">
                          {p.nombre}
                        </Link>
                      ) : (
                        p.nombre
                      )}
                    </div>
                    <div className="text-xs text-t2 font-mono">
                      {p.codigo}
                      {p.categoria && <span className="font-sans"> · {p.categoria}</span>}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">
                    <span className="font-semibold tabular-nums">{p.stockActual}</span>{' '}
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${estado.clase}`}
                    >
                      {estado.texto}
                    </span>
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatearPesos(p.precioVenta)}
                  </td>
                  {esDuenio && (
                    <td className="px-3 py-3 text-right tabular-nums text-t2">
                      {formatearPesos(p.costoReposicion)}
                    </td>
                  )}
                  {esDuenio && (
                    <td className="px-5 py-3 text-right whitespace-nowrap">
                      {p.activo ? (
                        <button
                          type="button"
                          className="text-xs font-semibold text-crit hover:underline"
                          disabled={baja.isPending}
                          onClick={() => darDeBaja(p)}
                        >
                          Dar de baja
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="text-xs font-semibold text-ok hover:underline"
                          disabled={actualizar.isPending}
                          onClick={() => reactivar(p)}
                        >
                          Reactivar
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
        {productos.hasNextPage && (
          <div className="p-4 border-t border-white/6 text-center">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={productos.isFetchingNextPage}
              onClick={() => void productos.fetchNextPage()}
            >
              {productos.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
