import {
  type ProductoCreate,
  ProductoCreateSchema,
  type ProductoPatch,
  ProductoPatchSchema,
} from '@inventariosmart/shared';
import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { useMe } from '@/lib/me';
import {
  formatearPesos,
  useActualizarProducto,
  useCrearProducto,
  useProducto,
} from '@/lib/productos';
import { ETIQUETA_ORIGEN } from '@inventariosmart/shared';
import { formatearFecha, useHistorialCostos, useProveedores } from '@/lib/proveedores';
import { Aviso } from '@/ui/Aviso';
import { Campo } from '@/ui/Campo';

interface Valores {
  codigo: string;
  nombre: string;
  categoria: string;
  precioVenta: string;
  alicuotaIva: string;
  costoReposicion: string;
  stockInicial: string;
  stockSeguridad: string;
  proveedorPrincipalId: string;
}

const VACIO: Valores = {
  codigo: '',
  nombre: '',
  categoria: '',
  precioVenta: '',
  alicuotaIva: '',
  costoReposicion: '',
  stockInicial: '0',
  stockSeguridad: '0',
  proveedorPrincipalId: '',
};

/** Alta (/productos/nuevo) y edición (/productos/:id) con el mismo formulario. */
export function ProductoFormPage() {
  const { id } = useParams<{ id: string }>();
  const esNuevo = !id;
  const me = useMe();
  const existente = useProducto(id);
  const crear = useCrearProducto();
  const actualizar = useActualizarProducto();
  const navigate = useNavigate();
  const [v, setV] = useState<Valores>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<{ tono: 'error' | 'plan'; texto: string } | null>(null);
  // Proveedores activos para elegir el principal (HU-02); historial de costos al editar.
  const proveedores = useProveedores({ activo: true }, 100, !esNuevo);
  const listaProveedores = proveedores.data?.pages.flatMap((p) => p.items) ?? [];
  const historial = useHistorialCostos(id);
  const costos = historial.data?.pages.flatMap((p) => p.items) ?? [];
  const principalActual = existente.data?.proveedorPrincipal ?? null;
  const principalInactivo =
    principalActual !== null && !listaProveedores.some((p) => p.id === principalActual.id);

  // Alícuota por defecto del comercio al crear; datos del producto al editar.
  useEffect(() => {
    if (esNuevo && me.data && v.alicuotaIva === '') {
      setV((s) => ({ ...s, alicuotaIva: me.data.comercio.ivaDefault }));
    }
  }, [esNuevo, me.data, v.alicuotaIva]);

  useEffect(() => {
    if (existente.data) {
      const p = existente.data;
      setV({
        codigo: p.codigo,
        nombre: p.nombre,
        categoria: p.categoria ?? '',
        precioVenta: p.precioVenta,
        alicuotaIva: p.alicuotaIva,
        costoReposicion: p.costoReposicion ?? '',
        stockInicial: String(p.stockActual),
        stockSeguridad: String(p.stockSeguridad),
        proveedorPrincipalId: p.proveedorPrincipal?.id ?? '',
      });
    }
  }, [existente.data]);

  const set = (campo: keyof Valores) => (valor: string) => setV((s) => ({ ...s, [campo]: valor }));
  const numero = (s: string) => (s.trim() === '' ? undefined : Number(s.replace(',', '.')));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    setErrores({});

    const comun = {
      codigo: v.codigo,
      nombre: v.nombre,
      categoria: v.categoria,
      precioVenta: v.precioVenta,
      alicuotaIva: numero(v.alicuotaIva),
      costoReposicion: v.costoReposicion,
      stockSeguridad: numero(v.stockSeguridad),
    };
    const parsed = esNuevo
      ? ProductoCreateSchema.safeParse({ ...comun, stockInicial: numero(v.stockInicial) })
      : ProductoPatchSchema.safeParse({
          ...comun,
          proveedorPrincipalId: v.proveedorPrincipalId === '' ? null : v.proveedorPrincipalId,
        });
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const i of parsed.error.issues) e2[String(i.path[0] ?? '_')] ??= i.message;
      setErrores(e2);
      if (e2['_']) setAviso({ tono: 'error', texto: e2['_'] });
      return;
    }

    const onError = (err: unknown) => {
      if (err instanceof ErrorApi) {
        if (err.status === 402) {
          setAviso({ tono: 'plan', texto: `Disponible en el plan PRO. ${err.message}` });
          return;
        }
        if (err.status === 409) {
          setErrores({ codigo: err.message });
          return;
        }
        if (err.status === 400 && err.error.details && typeof err.error.details === 'object') {
          setErrores(err.error.details as Record<string, string>);
          return;
        }
      }
      setAviso({ tono: 'error', texto: mensajeDe(err) });
    };

    if (esNuevo) {
      crear.mutate(parsed.data as ProductoCreate, {
        onSuccess: () => navigate('/productos'),
        onError,
      });
    } else {
      actualizar.mutate(
        { id: id!, ...(parsed.data as ProductoPatch) },
        { onSuccess: () => navigate('/productos'), onError },
      );
    }
  };

  const enviando = crear.isPending || actualizar.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link
        to="/productos"
        className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Inventario
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {esNuevo ? 'Nuevo producto' : (existente.data?.nombre ?? 'Editar producto')}
        </h1>
        <p className="text-t2 text-sm mt-1">
          Precio con IVA incluido; costo de reposición sin IVA, como en las listas de proveedores.
        </p>
      </header>

      {!esNuevo && existente.isError && <Aviso tono="error">{mensajeDe(existente.error)}</Aviso>}

      <form onSubmit={onSubmit} className="card p-5 space-y-4" noValidate>
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            label="Código"
            value={v.codigo}
            onChange={set('codigo')}
            placeholder="FA-220"
            error={errores['codigo']}
            autoFocus={esNuevo}
          />
          <Campo
            label="Categoría"
            value={v.categoria}
            onChange={set('categoria')}
            placeholder="Repuestos"
            ayuda="Opcional"
            error={errores['categoria']}
          />
        </div>
        <Campo
          label="Nombre"
          value={v.nombre}
          onChange={set('nombre')}
          placeholder="Filtro Aire FA-220"
          error={errores['nombre']}
        />
        <div className="grid gap-4 md:grid-cols-3">
          <Campo
            label="Precio de venta ($)"
            value={v.precioVenta}
            onChange={set('precioVenta')}
            placeholder="3900"
            inputMode="decimal"
            ayuda="Con IVA incluido"
            error={errores['precioVenta']}
          />
          <Campo
            label="IVA (%)"
            value={v.alicuotaIva}
            onChange={set('alicuotaIva')}
            placeholder="21"
            inputMode="decimal"
            error={errores['alicuotaIva']}
          />
          <Campo
            label="Costo de reposición ($)"
            value={v.costoReposicion}
            onChange={set('costoReposicion')}
            placeholder="2340"
            inputMode="decimal"
            ayuda="Sin IVA"
            error={errores['costoReposicion']}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {esNuevo ? (
            <Campo
              label="Stock inicial"
              value={v.stockInicial}
              onChange={set('stockInicial')}
              inputMode="numeric"
              error={errores['stockInicial']}
            />
          ) : (
            <label className="block">
              <span className="block text-xs font-semibold text-t2 mb-1.5">Stock actual</span>
              <div className="w-full rounded-xl bg-white/[0.03] border border-white/8 px-4 py-3 text-sm text-t2">
                {v.stockInicial} unidades
                <span className="block text-xs text-t3 mt-1">
                  Se ajusta con movimientos de stock, no desde acá.
                </span>
              </div>
            </label>
          )}
          <Campo
            label="Stock de seguridad"
            value={v.stockSeguridad}
            onChange={set('stockSeguridad')}
            inputMode="numeric"
            ayuda="Por debajo de este valor el producto figura como Bajo"
            error={errores['stockSeguridad']}
          />
        </div>

        {!esNuevo && (
          <label className="block">
            <span className="block text-xs font-semibold text-t2 mb-1.5">Proveedor principal</span>
            <select
              value={v.proveedorPrincipalId}
              onChange={(e) => set('proveedorPrincipalId')(e.target.value)}
              className="w-full rounded-xl bg-[#070C16] border border-white/12 px-4 py-3 text-sm outline-none focus:border-brand-2 focus:ring-4 focus:ring-brand/15"
            >
              <option value="">Sin proveedor</option>
              {principalInactivo && principalActual && (
                <option value={principalActual.id}>{principalActual.nombre} (dado de baja)</option>
              )}
              {listaProveedores.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
            <span className="block text-xs text-t3 mt-1.5">
              {errores['proveedorPrincipalId'] ??
                'Su última lista de precios fija el costo de reposición (RN-08).'}
            </span>
          </label>
        )}

        {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {esNuevo ? 'Crear producto' : 'Guardar cambios'}
          </button>
          <Link to="/productos" className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>

      {!esNuevo && (
        <section className="space-y-3">
          <h2 className="font-bold">Historial de costos</h2>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead className="text-xs uppercase tracking-wider text-t3 bg-white/[0.03]">
                <tr>
                  <th className="text-left px-5 py-3">Vigente desde</th>
                  <th className="text-left px-3 py-3">Proveedor</th>
                  <th className="text-right px-3 py-3">Costo neto</th>
                  <th className="text-left px-5 py-3">Origen</th>
                </tr>
              </thead>
              <tbody>
                {historial.isSuccess && costos.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-t2">
                      Todavía ningún proveedor informó un costo para este producto.
                    </td>
                  </tr>
                )}
                {costos.map((c) => (
                  <tr key={c.id} className="border-t border-white/6">
                    <td className="px-5 py-2.5 text-t2 whitespace-nowrap">
                      {formatearFecha(c.vigenteDesde)}
                    </td>
                    <td className="px-3 py-2.5">
                      <Link to={`/proveedores/${c.proveedor.id}`} className="hover:text-brand-3">
                        {c.proveedor.nombre}
                      </Link>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {formatearPesos(c.costoNeto)}
                    </td>
                    <td className="px-5 py-2.5 text-t2">{ETIQUETA_ORIGEN[c.origen]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {historial.hasNextPage && (
              <div className="p-4 border-t border-white/6 text-center">
                <button
                  type="button"
                  className="btn btn-ghost"
                  disabled={historial.isFetchingNextPage}
                  onClick={() => void historial.fetchNextPage()}
                >
                  {historial.isFetchingNextPage ? 'Cargando…' : 'Ver más'}
                </button>
              </div>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
