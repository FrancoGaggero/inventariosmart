import {
  ETIQUETA_PERIODICIDAD,
  ETIQUETA_TIPO_GASTO,
  GastoCreateSchema,
  GastoPatchSchema,
  MesSchema,
  PERIODICIDADES,
  TIPOS_GASTO,
  mesActual,
  type GastoCreate,
  type GastoPatch,
  type Periodicidad,
  type TipoGasto,
} from '@inventariosmart/shared';
import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { useActualizarGasto, useCrearGasto, useGasto } from '@/lib/gastos';
import { Aviso } from '@/ui/Aviso';
import { Campo } from '@/ui/Campo';

interface Valores {
  concepto: string;
  tipo: TipoGasto;
  importe: string;
  periodo: string;
  periodicidad: Periodicidad;
  fin: string;
  notas: string;
}

const AYUDA_PERIODICIDAD: Record<Periodicidad, string> = {
  UNICO: 'Cuenta sólo en el mes elegido.',
  MENSUAL: 'Cuenta todos los meses desde el mes de inicio, hasta el fin si lo indicás.',
  ANUAL: 'Se prorratea en doceavos durante doce meses desde el mes de inicio.',
};

function Segmentos<T extends string>({
  opciones,
  valor,
  onChange,
  etiqueta,
}: {
  opciones: readonly T[];
  valor: T;
  onChange: (v: T) => void;
  etiqueta: (v: T) => string;
}) {
  return (
    <div
      role="tablist"
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${opciones.length}, 1fr)` }}
    >
      {opciones.map((o) => (
        <button
          key={o}
          type="button"
          role="tab"
          aria-selected={valor === o}
          onClick={() => onChange(o)}
          className={`py-2.5 rounded-xl text-sm font-bold border transition ${
            valor === o
              ? 'bg-brand border-brand text-on-brand'
              : 'border-line text-t2 hover:text-t1 hover:border-brand-2'
          }`}
        >
          {etiqueta(o)}
        </button>
      ))}
    </div>
  );
}

/** Alta (/gastos/nuevo?periodo=) y edición (/gastos/:id). Sólo DUENIO. */
export function GastoFormPage() {
  const { id } = useParams<{ id: string }>();
  const [params] = useSearchParams();
  const esNuevo = !id;
  const existente = useGasto(id);
  const crear = useCrearGasto();
  const actualizar = useActualizarGasto();
  const navigate = useNavigate();
  const periodoInicial = params.get('periodo');
  const [v, setV] = useState<Valores>({
    concepto: '',
    tipo: 'FIJO',
    importe: '',
    periodo: MesSchema.safeParse(periodoInicial).success ? periodoInicial! : mesActual(),
    periodicidad: 'MENSUAL',
    fin: '',
    notas: '',
  });
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (existente.data) {
      const g = existente.data;
      setV({
        concepto: g.concepto,
        tipo: g.tipo,
        importe: g.importe,
        periodo: g.periodo,
        periodicidad: g.periodicidad,
        fin: g.fin ?? '',
        notas: g.notas ?? '',
      });
    }
  }, [existente.data]);

  const set =
    <K extends keyof Valores>(campo: K) =>
    (valor: Valores[K]) =>
      setV((s) => ({ ...s, [campo]: valor }));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    setErrores({});
    const datos = {
      concepto: v.concepto,
      tipo: v.tipo,
      importe: v.importe,
      periodo: v.periodo,
      periodicidad: v.periodicidad,
      fin: v.periodicidad === 'UNICO' || v.fin === '' ? null : v.fin,
      notas: v.notas,
    };
    const parsed = esNuevo ? GastoCreateSchema.safeParse(datos) : GastoPatchSchema.safeParse(datos);
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const i of parsed.error.issues) e2[String(i.path[0] ?? '_')] ??= i.message;
      setErrores(e2);
      if (e2['_']) setAviso(e2['_']);
      return;
    }
    const onError = (err: unknown) => {
      if (
        err instanceof ErrorApi &&
        err.status === 400 &&
        err.error.details &&
        typeof err.error.details === 'object'
      ) {
        setErrores(err.error.details as Record<string, string>);
        return;
      }
      setAviso(mensajeDe(err));
    };
    const volver = () => navigate(`/gastos`);
    if (esNuevo) {
      crear.mutate(parsed.data as GastoCreate, { onSuccess: volver, onError });
    } else {
      actualizar.mutate(
        { id: id!, ...(parsed.data as GastoPatch) },
        { onSuccess: volver, onError },
      );
    }
  };

  const enviando = crear.isPending || actualizar.isPending;
  const recurrente = v.periodicidad !== 'UNICO';

  return (
    <div className="space-y-6 max-w-2xl">
      <Link to="/gastos" className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1">
        <ArrowLeft className="w-4 h-4" aria-hidden />
        Gastos
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {esNuevo ? 'Nuevo gasto' : (existente.data?.concepto ?? 'Editar gasto')}
        </h1>
        <p className="text-t2 text-sm mt-1">
          Importes netos, sin IVA, como los costos de reposición (RN-03).
        </p>
      </header>

      {!esNuevo && existente.isError && <Aviso tono="error">{mensajeDe(existente.error)}</Aviso>}

      <form onSubmit={onSubmit} className="card p-5 space-y-5" noValidate>
        <Campo
          label="Concepto"
          value={v.concepto}
          onChange={set('concepto')}
          placeholder="Alquiler del local"
          error={errores['concepto']}
          autoFocus={esNuevo}
        />
        <div>
          <span className="block text-xs font-semibold text-t2 mb-1.5">Tipo</span>
          <Segmentos
            opciones={TIPOS_GASTO}
            valor={v.tipo}
            onChange={set('tipo')}
            etiqueta={(t) => ETIQUETA_TIPO_GASTO[t]}
          />
          <span className="block text-xs text-t3 mt-1.5">
            {errores['tipo'] ??
              'Fijo: alquiler, sueldos, servicios. Variable: comisiones, fletes, embalajes.'}
          </span>
        </div>
        <div>
          <span className="block text-xs font-semibold text-t2 mb-1.5">Periodicidad</span>
          <Segmentos
            opciones={PERIODICIDADES}
            valor={v.periodicidad}
            onChange={set('periodicidad')}
            etiqueta={(p) => ETIQUETA_PERIODICIDAD[p]}
          />
          <span className="block text-xs text-t3 mt-1.5">
            {errores['periodicidad'] ?? AYUDA_PERIODICIDAD[v.periodicidad]}
          </span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          <Campo
            label={v.periodicidad === 'ANUAL' ? 'Importe anual ($)' : 'Importe ($)'}
            value={v.importe}
            onChange={set('importe')}
            inputMode="decimal"
            placeholder="250000"
            ayuda="Sin IVA"
            error={errores['importe']}
          />
          <Campo
            label={recurrente ? 'Mes de inicio' : 'Mes'}
            type="month"
            value={v.periodo}
            onChange={set('periodo')}
            error={errores['periodo']}
          />
          {recurrente && (
            <Campo
              label="Hasta (opcional)"
              type="month"
              value={v.fin}
              onChange={set('fin')}
              ayuda="Último mes en que aplica"
              error={errores['fin']}
            />
          )}
        </div>
        <Campo
          label="Notas"
          value={v.notas}
          onChange={set('notas')}
          placeholder="Opcional"
          maxLength={300}
          error={errores['notas']}
        />

        {aviso && <Aviso tono="error">{aviso}</Aviso>}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {esNuevo ? 'Cargar gasto' : 'Guardar cambios'}
          </button>
          <Link to="/gastos" className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
