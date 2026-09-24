import {
  ETIQUETA_ESTADO_FILA,
  LIMITE_BYTES_IMPORTACION,
  filasAplicables,
  type EstadoFilaImportacion,
  type ResultadoImportacion,
  type VistaPrevia,
} from '@inventariosmart/shared';
import { ArrowLeft, CheckCircle2, FileSpreadsheet, Upload } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { Link, useParams } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { formatearPesos } from '@/lib/productos';
import { useConfirmarImportacion, useProveedor, useVistaPrevia } from '@/lib/proveedores';
import { Aviso } from '@/ui/Aviso';

type Filtro = 'TODAS' | EstadoFilaImportacion;

const CLASE_ESTADO: Record<EstadoFilaImportacion, string> = {
  NUEVO: 'bg-ok/15 text-ok',
  CAMBIA: 'bg-brand/15 text-brand-3',
  IGUAL: 'bg-fill text-t2',
  SIN_PRODUCTO: 'bg-warn/15 text-warn',
  INVALIDA: 'bg-crit/15 text-crit',
};

/** Importación de lista de precios en tres pasos: archivo → vista previa → resultado. */
export function ImportarListaPage() {
  const { id } = useParams<{ id: string }>();
  const proveedor = useProveedor(id);
  const vistaPrevia = useVistaPrevia(id!);
  const confirmar = useConfirmarImportacion(id!);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [previa, setPrevia] = useState<VistaPrevia | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const [filtro, setFiltro] = useState<Filtro>('TODAS');
  const [error, setError] = useState<string | null>(null);

  const subir = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!archivo) {
      setError('Elegí un archivo .xlsx o .csv.');
      return;
    }
    if (archivo.size > LIMITE_BYTES_IMPORTACION) {
      setError('El archivo supera los 2 MB.');
      return;
    }
    vistaPrevia.mutate(archivo, {
      onSuccess: (v) => {
        setPrevia(v);
        setFiltro('TODAS');
      },
      onError: (err) => setError(err instanceof ErrorApi ? err.message : mensajeDe(err)),
    });
  };

  const aplicables = previa ? filasAplicables(previa.filas) : [];

  const confirmarImportacion = () => {
    setError(null);
    confirmar.mutate(
      { items: aplicables },
      {
        onSuccess: setResultado,
        onError: (err) => setError(err instanceof ErrorApi ? err.message : mensajeDe(err)),
      },
    );
  };

  const reiniciar = () => {
    setArchivo(null);
    setPrevia(null);
    setResultado(null);
    setError(null);
  };

  const filas = previa?.filas.filter((f) => filtro === 'TODAS' || f.estado === filtro) ?? [];
  const paso = resultado ? 3 : previa ? 2 : 1;

  return (
    <div className="space-y-6">
      <Link
        to={`/proveedores/${id}`}
        className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden />
        {proveedor.data?.nombre ?? 'Proveedor'}
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Importar lista de precios</h1>
        <p className="text-t2 text-sm mt-1">
          Paso {paso} de 3 ·{' '}
          {paso === 1 ? 'Elegí la planilla' : paso === 2 ? 'Revisá qué va a cambiar' : 'Listo'}
        </p>
      </header>

      {error && <Aviso tono="error">{error}</Aviso>}

      {paso === 1 && (
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
          <div className="text-xs text-t3 space-y-1">
            <p>
              Dos columnas: <b className="text-t2">código</b> del producto y{' '}
              <b className="text-t2">costo</b> neto sin IVA. Hasta 5.000 filas y 2 MB. Los códigos
              que no existan en tu inventario se informan y se omiten.
            </p>
            <p>
              <a
                href="/plantillas/lista-de-precios.csv"
                download
                className="text-brand-3 font-semibold"
              >
                Descargar planilla de ejemplo
              </a>
            </p>
          </div>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={vistaPrevia.isPending || !archivo}
          >
            <Upload className="w-4 h-4" aria-hidden />
            {vistaPrevia.isPending ? 'Leyendo…' : 'Subir y revisar'}
          </button>
        </form>
      )}

      {paso === 2 && previa && (
        <>
          <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar filas">
            {(
              [
                ['TODAS', `Todas (${previa.resumen.total})`],
                ['NUEVO', `${ETIQUETA_ESTADO_FILA.NUEVO} (${previa.resumen.nuevos})`],
                ['CAMBIA', `${ETIQUETA_ESTADO_FILA.CAMBIA} (${previa.resumen.cambios})`],
                ['IGUAL', `${ETIQUETA_ESTADO_FILA.IGUAL} (${previa.resumen.iguales})`],
                [
                  'SIN_PRODUCTO',
                  `${ETIQUETA_ESTADO_FILA.SIN_PRODUCTO} (${previa.resumen.sinProducto})`,
                ],
                ['INVALIDA', `${ETIQUETA_ESTADO_FILA.INVALIDA} (${previa.resumen.invalidas})`],
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
            <table className="w-full text-sm min-w-[680px]">
              <thead className="text-xs uppercase tracking-wider text-t3 bg-fill">
                <tr>
                  <th className="text-right px-4 py-3">Fila</th>
                  <th className="text-left px-3 py-3">Código</th>
                  <th className="text-left px-3 py-3">Producto</th>
                  <th className="text-right px-3 py-3">Costo anterior</th>
                  <th className="text-right px-3 py-3">Costo nuevo</th>
                  <th className="text-left px-5 py-3">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-t2">
                      No hay filas en este estado.
                    </td>
                  </tr>
                )}
                {filas.map((f) => (
                  <tr key={f.fila} className="border-t border-line">
                    <td className="px-4 py-2.5 text-right tabular-nums text-t3">{f.fila}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{f.codigo || '—'}</td>
                    <td className="px-3 py-2.5">
                      {f.nombre ?? <span className="text-t3">—</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-t2">
                      {f.costoAnterior ? formatearPesos(f.costoAnterior) : '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold">
                      {f.costoNeto ? formatearPesos(f.costoNeto) : '—'}
                    </td>
                    <td className="px-5 py-2.5">
                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${CLASE_ESTADO[f.estado]}`}
                      >
                        {ETIQUETA_ESTADO_FILA[f.estado]}
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
              disabled={confirmar.isPending || aplicables.length === 0}
              onClick={confirmarImportacion}
            >
              <CheckCircle2 className="w-4 h-4" aria-hidden />
              {confirmar.isPending
                ? 'Importando…'
                : `Confirmar ${aplicables.length} ${aplicables.length === 1 ? 'costo' : 'costos'}`}
            </button>
            <button type="button" className="btn btn-ghost" onClick={reiniciar}>
              Elegir otro archivo
            </button>
            {aplicables.length === 0 && (
              <span className="text-sm text-t2">No hay costos nuevos ni cambios para aplicar.</span>
            )}
          </div>
        </>
      )}

      {paso === 3 && resultado && (
        <div className="card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-6 h-6 text-ok" aria-hidden />
            <h2 className="font-bold text-lg">Lista importada</h2>
          </div>
          <dl className="grid gap-2 sm:grid-cols-2 text-sm">
            <div className="rounded-xl bg-fill p-4">
              <dt className="text-t2">Costos registrados</dt>
              <dd className="text-2xl font-extrabold tabular-nums">{resultado.insertados}</dd>
            </div>
            <div className="rounded-xl bg-fill p-4">
              <dt className="text-t2">Productos con costo vigente nuevo</dt>
              <dd className="text-2xl font-extrabold tabular-nums">
                {resultado.productosActualizados}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-t3">
            Los productos cuyo proveedor principal es otro guardan el costo en su historial sin
            cambiar el vigente.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to={`/proveedores/${id}`} className="btn btn-primary">
              Ver lista vigente
            </Link>
            <button type="button" className="btn btn-ghost" onClick={reiniciar}>
              Importar otra
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
