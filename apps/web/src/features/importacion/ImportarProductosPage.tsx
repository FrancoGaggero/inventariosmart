import {
  COLUMNAS_IMPORTACION,
  ETIQUETA_ESTADO_FILA_PRODUCTO,
  LIMITE_BYTES_IMPORTACION,
  filasAplicablesProductos,
  type EstadoFilaProducto,
  type ResultadoImportacionProductos,
  type VistaPreviaImportacion,
} from '@inventariosmart/shared';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { useConfirmarImportacionProductos, useVistaPreviaProductos } from '@/lib/importacion';
import { formatearPesos } from '@/lib/productos';
import { Aviso } from '@/ui/Aviso';

type Filtro = 'TODAS' | EstadoFilaProducto;

const CLASE_ESTADO: Record<EstadoFilaProducto, string> = {
  NUEVO: 'bg-ok/15 text-ok',
  ACTUALIZA: 'bg-brand/15 text-brand-3',
  INVALIDA: 'bg-crit/15 text-crit',
};

/** Asistente de importación de productos en tres pasos (HU-05). También es el onboarding. */
export function ImportarProductosPage() {
  const [params] = useSearchParams();
  const enOnboarding = params.get('onboarding') === '1';
  const navigate = useNavigate();
  const vistaPrevia = useVistaPreviaProductos();
  const confirmar = useConfirmarImportacionProductos();
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<VistaPreviaImportacion | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacionProductos | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [error, setError] = useState<string | null>(null);

  const subir = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!archivo) return setError('Elegí un archivo .xlsx o .csv.');
    if (archivo.size > LIMITE_BYTES_IMPORTACION) return setError('El archivo supera los 2 MB.');
    vistaPrevia.mutate(archivo, {
      onSuccess: (v) => {
        setPrevia(v);
        setFiltro('TODAS');
      },
      onError: (err) => setError(err instanceof ErrorApi ? err.message : mensajeDe(err)),
    });
  };

  const aplicables = previa ? filasAplicablesProductos(previa.filas) : [];
  const confirmarImportacion = () => {
    setError(null);
    confirmar.mutate(
      { filas: aplicables },
      {
        onSuccess: setResultado,
        onError: (err) => setError(err instanceof ErrorApi ? err.message : mensajeDe(err)),
      },
    );
  };

  const cancelar = () => navigate(enOnboarding ? '/' : '/productos');
  const reiniciar = () => {
    setArchivo(null);
    setPrevia(null);
    setResultado(null);
    setError(null);
  };

  const filas = previa?.filas.filter((f) => filtro === 'TODAS' || f.estado === filtro) ?? [];
  const paso = resultado ? 3 : previa ? 2 : 1;
  const r = previa?.resumen;

  return (
    <div className="space-y-6">
      {!enOnboarding && (
        <Link
          to="/productos"
          className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1"
        >
          <ArrowLeft className="w-4 h-4" aria-hidden />
          Inventario
        </Link>
      )}
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {enOnboarding ? 'Importá tu inventario' : 'Importar productos desde Excel'}
        </h1>
        <p className="text-t2 text-sm mt-1">
          Paso {paso} de 3 ·{' '}
          {paso === 1 ? 'Elegí la planilla' : paso === 2 ? 'Revisá qué se va a cargar' : 'Listo'}
        </p>
      </header>

      {error && <Aviso tono="error">{error}</Aviso>}

      {paso === 1 && (
        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <form onSubmit={subir} className="card p-5 space-y-4" noValidate>
            <label className="block">
              <span className="block text-xs font-semibold text-t2 mb-1.5">
                Planilla (.xlsx o .csv)
              </span>
              <input
                type="file"
                accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-t2 file:mr-4 file:rounded-lg file:border-0 file:bg-brand/15 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-brand-3 hover:file:bg-brand/25"
              />
            </label>
            <p className="text-xs text-t3">
              Hasta 5.000 filas y 2 MB. Los códigos que ya existan se actualizan (precio, costo,
              nombre…) sin tocar su stock. Nada se guarda hasta que confirmes.{' '}
              <a href="/plantillas/productos.csv" download className="text-brand-3 font-semibold">
                Descargar planilla de ejemplo
              </a>
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={vistaPrevia.isPending || !archivo}
              >
                <Upload className="w-4 h-4" aria-hidden />
                {vistaPrevia.isPending ? 'Leyendo…' : 'Subir y revisar'}
              </button>
              <button type="button" className="btn btn-ghost" onClick={cancelar}>
                {enOnboarding ? 'Lo hago más tarde' : 'Cancelar'}
              </button>
            </div>
          </form>
          <aside className="card p-5 text-sm">
            <h2 className="font-bold mb-2">Columnas admitidas</h2>
            <ul className="space-y-1.5">
              {Object.entries(COLUMNAS_IMPORTACION).map(([campo, c]) => (
                <li key={campo}>
                  <span className="font-mono text-xs text-brand-3">{c.alias[0]}</span>
                  {c.obligatoria && <span className="text-crit"> *</span>}
                  <span className="block text-xs text-t2">{c.descripcion}</span>
                </li>
              ))}
            </ul>
            <p className="text-xs text-t3 mt-3">
              Los encabezados se reconocen con variantes ("Precio de venta", "Stock mínimo",
              "Rubro"…).
            </p>
          </aside>
        </div>
      )}

      {paso === 2 && previa && r && (
        <>
          <div className="card p-5 space-y-2">
            <p className="font-semibold">
              {r.nuevos} {r.nuevos === 1 ? 'producto nuevo' : 'productos nuevos'}, {r.actualizan} a
              actualizar y {r.invalidas} con errores, de {r.total} filas.
            </p>
            <p className="text-sm text-t2">
              Tu inventario quedaría con {r.productosResultantes} productos activos
              {r.limitePlan !== null ? ` (tu plan admite ${r.limitePlan})` : ''}.
            </p>
            {r.superaLimite && (
              <Aviso tono="plan">
                Esta importación supera el límite de productos de tu plan. Pasá al plan PRO o
                importá menos productos.
              </Aviso>
            )}
          </div>

          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar filas">
            {(
              [
                ['TODAS', `Todas (${r.total})`],
                ['NUEVO', `${ETIQUETA_ESTADO_FILA_PRODUCTO.NUEVO} (${r.nuevos})`],
                ['ACTUALIZA', `${ETIQUETA_ESTADO_FILA_PRODUCTO.ACTUALIZA} (${r.actualizan})`],
                ['INVALIDA', `${ETIQUETA_ESTADO_FILA_PRODUCTO.INVALIDA} (${r.invalidas})`],
              ] as [Filtro, string][]
            ).map(([valor, etiqueta]) => (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={filtro === valor}
                onClick={() => setFiltro(valor)}
                className={`chip ${filtro === valor ? 'chip-activo' : ''}`}
              >
                {etiqueta}
              </button>
            ))}
          </div>

          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead className="text-xs uppercase tracking-wider text-t3 bg-fill">
                <tr>
                  <th className="text-right px-4 py-3">Fila</th>
                  <th className="text-left px-3 py-3">Código</th>
                  <th className="text-left px-3 py-3">Nombre</th>
                  <th className="text-right px-3 py-3">Precio</th>
                  <th className="text-right px-3 py-3">Costo</th>
                  <th className="text-right px-3 py-3">Stock</th>
                  <th className="text-left px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-8 text-center text-t2">
                      No hay filas en este estado.
                    </td>
                  </tr>
                )}
                {filas.map((f) => (
                  <tr key={f.fila} className="border-t border-line">
                    <td className="px-4 py-2.5 text-right tabular-nums text-t3">{f.fila}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{f.codigo || '—'}</td>
                    <td className="px-3 py-2.5">
                      {f.datos?.nombre ?? <span className="text-t3">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {f.datos ? formatearPesos(f.datos.precioVenta) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-t2">
                      {f.datos ? formatearPesos(f.datos.costoReposicion) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums">
                      {f.estado === 'ACTUALIZA'
                        ? `${f.stockActual ?? 0} (no cambia)`
                        : f.datos
                          ? f.datos.stockInicial
                          : '—'}
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CLASE_ESTADO[f.estado]}`}
                      >
                        {ETIQUETA_ESTADO_FILA_PRODUCTO[f.estado]}
                      </span>
                      {f.error && <span className="block text-xs text-t3 mt-1">{f.error}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="btn btn-primary"
              disabled={confirmar.isPending || aplicables.length === 0 || r.superaLimite}
              onClick={confirmarImportacion}
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden />
              {confirmar.isPending
                ? 'Importando…'
                : `Importar ${aplicables.length} ${aplicables.length === 1 ? 'producto' : 'productos'}`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reiniciar}>
              Elegir otro archivo
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancelar}>
              Cancelar
            </button>
          </div>
        </>
      )}

      {paso === 3 && resultado && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-ok" aria-hidden />
            <h2 className="font-bold text-lg">Inventario importado</h2>
          </div>
          <dl className="grid gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded-xl bg-fill p-4">
              <dt className="text-t2">Productos creados</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{resultado.creados}</dd>
            </div>
            <div className="rounded-xl bg-fill p-4">
              <dt className="text-t2">Actualizados</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{resultado.actualizados}</dd>
            </div>
            <div className="rounded-xl bg-fill p-4">
              <dt className="text-t2">Omitidos</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{resultado.omitidos}</dd>
            </div>
          </dl>
          {resultado.detalles.length > 0 && (
            <ul className="text-sm text-t2 space-y-1">
              {resultado.detalles.map((d) => (
                <li key={`${d.fila}-${d.codigo}`}>
                  Fila {d.fila} ({d.codigo}): {d.motivo}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-3">
            <Link to="/productos" className="btn btn-primary">
              Ver inventario
            </Link>
            <button type="button" className="btn btn-ghost" onClick={reiniciar}>
              Importar otra planilla
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
