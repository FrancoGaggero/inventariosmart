import type { EstadoStock } from '@inventariosmart/shared';
import { FileSpreadsheet, Plus, Search } from 'lucide-react';
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
import { Entrada } from '@/ui/Entrada';
import { EstadoVacio } from '@/ui/EstadoVacio';
import { SkeletonFilas } from '@/ui/Skeleton';

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
  const filtrado = !!q || chip !== 'TODOS';

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

  /** Acciones de una fila, compartidas por la tabla y las tarjetas. */
  const acciones = (p: Producto) => (
    <>
      {p.activo && (
        <>
          <Link
            to={`/movimientos/nuevo?productoId=${p.id}&tipo=VENTA`}
            className="text-xs font-semibold text-brand-3 hover:underline"
          >
            Vender
          </Link>
          <Link
            to={`/movimientos/nuevo?productoId=${p.id}&tipo=INGRESO`}
            className="text-xs font-semibold text-brand-3 hover:underline"
          >
            Ingresar
          </Link>
        </>
      )}
      <Link
        to={`/movimientos?productoId=${p.id}`}
        className="text-xs font-semibold text-t2 hover:text-t1 hover:underline"
      >
        Historial
      </Link>
      {esDuenio &&
        (p.activo ? (
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
        ))}
    </>
  );

  const nombre = (p: Producto) =>
    esDuenio ? (
      <Link to={`/productos/${p.id}`} className="hover:text-brand-3">
        {p.nombre}
      </Link>
    ) : (
      p.nombre
    );

  const vacio = (
    <EstadoVacio
      ilustracion="cajas"
      titulo={filtrado ? 'No hay productos que coincidan.' : 'Todavía no cargaste productos.'}
      texto={
        filtrado
          ? 'Probá con otro texto o cambiá el filtro de estado.'
          : 'Cargá tu catálogo a mano o importá la planilla que ya usás.'
      }
      accion={
        esDuenio &&
        !filtrado && (
          <>
            <Link to="/productos/nuevo" className="btn btn-primary">
              <Plus className="w-4 h-4" aria-hidden />
              Cargar el primero
            </Link>
            <Link to="/importar" className="btn btn-ghost">
              <FileSpreadsheet className="w-4 h-4" aria-hidden />
              Importar planilla
            </Link>
          </>
        )
      }
    />
  );

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
          <div className="flex flex-wrap gap-2">
            <Link to="/importar" className="btn btn-ghost">
              <FileSpreadsheet className="w-4 h-4" aria-hidden />
              Importar desde Excel
            </Link>
            <Link to="/productos/nuevo" className="btn btn-primary">
              <Plus className="w-4 h-4" aria-hidden />
              Nuevo producto
            </Link>
          </div>
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
            className="campo !pl-9 !py-2.5"
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
              className={`chip ${chip === c.valor ? 'chip-activo' : ''}`}
            >
              {c.texto}
            </button>
          ))}
        </div>
      </div>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <section className="card">
        {productos.isPending && <SkeletonFilas filas={5} />}
        {productos.isError && <p className="px-5 py-8 text-crit">{mensajeDe(productos.error)}</p>}
        {productos.isSuccess && items.length === 0 && vacio}

        {items.length > 0 && (
          <>
            {/* Tarjetas apiladas en pantallas angostas (design D5). */}
            <ul className="sm:hidden divide-y divide-line">
              {items.map((p, i) => {
                const estado = ETIQUETA_ESTADO[p.estadoStock];
                return (
                  <Entrada
                    as="li"
                    indice={i}
                    key={p.id}
                    className={`p-4 space-y-2 ${p.activo ? '' : 'opacity-60'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold truncate">{nombre(p)}</div>
                        <div className="text-xs text-t2 font-mono">
                          {p.codigo}
                          {p.categoria && <span className="font-sans"> · {p.categoria}</span>}
                        </div>
                      </div>
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${estado.clase}`}
                      >
                        {estado.texto}
                      </span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 text-xs">
                      <div>
                        <dt className="text-t3">Stock</dt>
                        <dd className="font-semibold tabular-nums">{p.stockActual}</dd>
                      </div>
                      <div>
                        <dt className="text-t3">Precio</dt>
                        <dd className="tabular-nums">{formatearPesos(p.precioVenta)}</dd>
                      </div>
                      {esDuenio && (
                        <div>
                          <dt className="text-t3">Costo</dt>
                          <dd className="tabular-nums text-t2">
                            {formatearPesos(p.costoReposicion)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">{acciones(p)}</div>
                  </Entrada>
                );
              })}
            </ul>

            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm min-w-[640px]">
                <thead className="thead-fija text-xs uppercase tracking-wider text-t3">
                  <tr>
                    <th className="text-left px-5 py-3">Producto</th>
                    <th className="text-right px-3 py-3">Stock</th>
                    <th className="text-right px-3 py-3">Precio</th>
                    {esDuenio && <th className="text-right px-3 py-3">Costo</th>}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {items.map((p, i) => {
                    const estado = ETIQUETA_ESTADO[p.estadoStock];
                    return (
                      <Entrada
                        as="tr"
                        indice={i}
                        key={p.id}
                        className={`border-t border-line transition-colors hover:bg-fill ${
                          p.activo ? '' : 'opacity-60'
                        }`}
                      >
                        <td className="px-5 py-3">
                          <div className="font-semibold">{nombre(p)}</div>
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
                        <td className="px-5 py-3 text-right whitespace-nowrap space-x-3">
                          {acciones(p)}
                        </td>
                      </Entrada>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {productos.hasNextPage && (
          <div className="p-4 border-t border-line text-center">
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
