import { Plus, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { mensajeDe } from '@/lib/api';
import {
  estrellas,
  type Proveedor,
  useActualizarProveedor,
  useDarDeBajaProveedor,
  useProveedores,
} from '@/lib/proveedores';
import { Aviso } from '@/ui/Aviso';
import { EstadoVacio } from '@/ui/EstadoVacio';

type Chip = 'ACTIVOS' | 'BAJAS';

/** Listado de proveedores (HU-02). Sólo DUENIO. */
export function ProveedoresPage() {
  const [texto, setTexto] = useState('');
  const [q, setQ] = useState('');
  const [chip, setChip] = useState<Chip>('ACTIVOS');
  const [aviso, setAviso] = useState<{ tono: 'ok' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setQ(texto.trim()), 300);
    return () => clearTimeout(id);
  }, [texto]);

  const proveedores = useProveedores({ q, activo: chip === 'ACTIVOS' });
  const baja = useDarDeBajaProveedor();
  const actualizar = useActualizarProveedor();
  const items = proveedores.data?.pages.flatMap((p) => p.items) ?? [];

  const darDeBaja = (p: Proveedor) => {
    if (!window.confirm(`¿Dar de baja "${p.nombre}"? Se conserva su historial de precios.`)) return;
    setAviso(null);
    baja.mutate(p.id, {
      onSuccess: () => setAviso({ tono: 'ok', texto: `${p.nombre} dado de baja.` }),
      onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
    });
  };

  const reactivar = (p: Proveedor) => {
    setAviso(null);
    actualizar.mutate(
      { id: p.id, activo: true },
      {
        onSuccess: () => setAviso({ tono: 'ok', texto: `${p.nombre} reactivado.` }),
        onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
      },
    );
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight">Proveedores</h1>
          <p className="text-t2 text-sm mt-1">
            Contactos, plazos de entrega y listas de precios que fijan tus costos.
          </p>
        </div>
        <Link to="/proveedores/nuevo" className="btn btn-primary">
          <Plus className="w-4 h-4" aria-hidden />
          Nuevo proveedor
        </Link>
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
            placeholder="Buscar por nombre…"
            aria-label="Buscar proveedor"
            className="campo !pl-9 !py-2.5"
          />
        </label>
        <div className="flex gap-2" role="tablist" aria-label="Filtrar por estado">
          {(
            [
              ['ACTIVOS', 'Activos'],
              ['BAJAS', 'Dados de baja'],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={chip === valor}
              onClick={() => setChip(valor)}
              className={`chip ${chip === valor ? 'chip-activo' : ''}`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

      <section className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead className="text-xs uppercase tracking-wider text-t3 bg-fill">
            <tr>
              <th className="text-left px-5 py-3">Proveedor</th>
              <th className="text-left px-3 py-3">Contacto</th>
              <th className="text-right px-3 py-3">Entrega</th>
              <th className="text-left px-3 py-3">Confiabilidad</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {proveedores.isPending && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-t2 text-center">
                  Cargando…
                </td>
              </tr>
            )}
            {proveedores.isError && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-crit">
                  {mensajeDe(proveedores.error)}
                </td>
              </tr>
            )}
            {proveedores.isSuccess && items.length === 0 && (
              <tr>
                <td colSpan={5}>
                  <EstadoVacio
                    ilustracion="camion"
                    titulo={
                      q || chip === 'BAJAS'
                        ? 'No hay proveedores que coincidan.'
                        : 'Todavía no cargaste proveedores.'
                    }
                    texto="Con sus listas de precios y plazos de entrega el sistema elige a quién pedir."
                    accion={
                      !q &&
                      chip === 'ACTIVOS' && (
                        <Link to="/proveedores/nuevo" className="btn btn-primary">
                          <Plus className="w-4 h-4" aria-hidden />
                          Cargar el primero
                        </Link>
                      )
                    }
                  />
                </td>
              </tr>
            )}
            {items.map((p) => (
              <tr key={p.id} className={`border-t border-line ${p.activo ? '' : 'opacity-60'}`}>
                <td className="px-5 py-3">
                  <Link to={`/proveedores/${p.id}`} className="font-semibold hover:text-brand-3">
                    {p.nombre}
                  </Link>
                  {p.cuit && <div className="text-xs text-t2 font-mono">CUIT {p.cuit}</div>}
                </td>
                <td className="px-3 py-3 text-t2">
                  {p.contacto && <div>{p.contacto}</div>}
                  {p.email && <div className="text-xs">{p.email}</div>}
                  {p.telefono && <div className="text-xs">{p.telefono}</div>}
                  {!p.contacto && !p.email && !p.telefono && '—'}
                </td>
                <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                  {p.leadTimeDias} {p.leadTimeDias === 1 ? 'día' : 'días'}
                </td>
                <td
                  className="px-3 py-3 text-warn tracking-wider"
                  title={`${p.confiabilidad} de 5`}
                >
                  {estrellas(p.confiabilidad)}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap space-x-3">
                  <Link
                    to={`/proveedores/${p.id}/editar`}
                    className="text-xs font-semibold text-brand-3 hover:underline"
                  >
                    Editar
                  </Link>
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
              </tr>
            ))}
          </tbody>
        </table>
        {proveedores.hasNextPage && (
          <div className="p-4 border-t border-line text-center">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={proveedores.isFetchingNextPage}
              onClick={() => void proveedores.fetchNextPage()}
            >
              {proveedores.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
