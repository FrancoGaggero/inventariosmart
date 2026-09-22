import {
  type ProveedorCreate,
  ProveedorCreateSchema,
  type ProveedorPatch,
  ProveedorPatchSchema,
} from '@inventariosmart/shared';
import { ArrowLeft } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import { useActualizarProveedor, useCrearProveedor, useProveedor } from '@/lib/proveedores';
import { Aviso } from '@/ui/Aviso';
import { Campo } from '@/ui/Campo';

interface Valores {
  nombre: string;
  contacto: string;
  email: string;
  telefono: string;
  cuit: string;
  leadTimeDias: string;
  confiabilidad: string;
  notas: string;
}

const VACIO: Valores = {
  nombre: '',
  contacto: '',
  email: '',
  telefono: '',
  cuit: '',
  leadTimeDias: '7',
  confiabilidad: '3',
  notas: '',
};

/** Alta (/proveedores/nuevo) y edición (/proveedores/:id/editar). */
export function ProveedorFormPage() {
  const { id } = useParams<{ id: string }>();
  const esNuevo = !id;
  const existente = useProveedor(id);
  const crear = useCrearProveedor();
  const actualizar = useActualizarProveedor();
  const navigate = useNavigate();
  const [v, setV] = useState<Valores>(VACIO);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (existente.data) {
      const p = existente.data;
      setV({
        nombre: p.nombre,
        contacto: p.contacto ?? '',
        email: p.email ?? '',
        telefono: p.telefono ?? '',
        cuit: p.cuit ?? '',
        leadTimeDias: String(p.leadTimeDias),
        confiabilidad: String(p.confiabilidad),
        notas: p.notas ?? '',
      });
    }
  }, [existente.data]);

  const set = (campo: keyof Valores) => (valor: string) => setV((s) => ({ ...s, [campo]: valor }));
  const numero = (s: string) => (s.trim() === '' ? undefined : Number(s));

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    setErrores({});
    const datos = {
      nombre: v.nombre,
      contacto: v.contacto,
      email: v.email,
      telefono: v.telefono,
      cuit: v.cuit,
      leadTimeDias: numero(v.leadTimeDias),
      confiabilidad: numero(v.confiabilidad),
      notas: v.notas,
    };
    const parsed = esNuevo
      ? ProveedorCreateSchema.safeParse(datos)
      : ProveedorPatchSchema.safeParse(datos);
    if (!parsed.success) {
      const e2: Record<string, string> = {};
      for (const i of parsed.error.issues) e2[String(i.path[0] ?? '_')] ??= i.message;
      setErrores(e2);
      if (e2['_']) setAviso(e2['_']);
      return;
    }
    const onError = (err: unknown) => {
      if (err instanceof ErrorApi) {
        if (err.status === 409) {
          setErrores({ nombre: err.message });
          return;
        }
        if (err.status === 400 && err.error.details && typeof err.error.details === 'object') {
          setErrores(err.error.details as Record<string, string>);
          return;
        }
      }
      setAviso(mensajeDe(err));
    };
    if (esNuevo) {
      crear.mutate(parsed.data as ProveedorCreate, {
        onSuccess: (p) => navigate(`/proveedores/${p.id}`),
        onError,
      });
    } else {
      actualizar.mutate(
        { id: id!, ...(parsed.data as ProveedorPatch) },
        { onSuccess: () => navigate(`/proveedores/${id}`), onError },
      );
    }
  };

  const volver = esNuevo ? '/proveedores' : `/proveedores/${id}`;
  const enviando = crear.isPending || actualizar.isPending;

  return (
    <div className="space-y-6 max-w-2xl">
      <Link to={volver} className="inline-flex items-center gap-1 text-sm text-t2 hover:text-t1">
        <ArrowLeft className="w-4 h-4" aria-hidden />
        {esNuevo ? 'Proveedores' : (existente.data?.nombre ?? 'Proveedor')}
      </Link>
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">
          {esNuevo ? 'Nuevo proveedor' : 'Editar proveedor'}
        </h1>
        <p className="text-t2 text-sm mt-1">
          El plazo de entrega alimenta el punto de reposición; la confiabilidad, el comparador.
        </p>
      </header>

      {!esNuevo && existente.isError && <Aviso tono="error">{mensajeDe(existente.error)}</Aviso>}

      <form onSubmit={onSubmit} className="card p-5 space-y-4" noValidate>
        <Campo
          label="Nombre"
          value={v.nombre}
          onChange={set('nombre')}
          placeholder="Distribuidora Norte"
          error={errores['nombre']}
          autoFocus={esNuevo}
        />
        <div className="grid gap-4 md:grid-cols-2">
          <Campo
            label="Persona de contacto"
            value={v.contacto}
            onChange={set('contacto')}
            ayuda="Opcional"
            error={errores['contacto']}
          />
          <Campo
            label="CUIT"
            value={v.cuit}
            onChange={set('cuit')}
            placeholder="30712345678"
            inputMode="numeric"
            ayuda="11 dígitos, sin guiones. Opcional"
            error={errores['cuit']}
          />
          <Campo
            label="Email"
            type="email"
            value={v.email}
            onChange={set('email')}
            placeholder="ventas@proveedor.com"
            ayuda="Opcional"
            error={errores['email']}
          />
          <Campo
            label="Teléfono"
            value={v.telefono}
            onChange={set('telefono')}
            placeholder="11-5555-0000"
            ayuda="Opcional"
            error={errores['telefono']}
          />
          <Campo
            label="Plazo de entrega (días)"
            value={v.leadTimeDias}
            onChange={set('leadTimeDias')}
            inputMode="numeric"
            ayuda="Desde que pedís hasta que llega (RN-04)"
            error={errores['leadTimeDias']}
          />
          <label className="block">
            <span className="block text-xs font-semibold text-t2 mb-1.5">Confiabilidad</span>
            <div className="flex gap-1" role="radiogroup" aria-label="Confiabilidad de 1 a 5">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  role="radio"
                  aria-checked={Number(v.confiabilidad) === n}
                  aria-label={`${n} de 5`}
                  onClick={() => set('confiabilidad')(String(n))}
                  className={`text-2xl leading-none transition ${
                    n <= Number(v.confiabilidad) ? 'text-warn' : 'text-t3 hover:text-warn/60'
                  }`}
                >
                  ★
                </button>
              ))}
            </div>
            <span className="block text-xs text-t3 mt-1.5">
              {errores['confiabilidad'] ?? 'Cumplimiento de plazos y calidad, a tu criterio'}
            </span>
          </label>
        </div>
        <Campo
          label="Notas"
          value={v.notas}
          onChange={set('notas')}
          placeholder="Condiciones de pago, horarios de entrega…"
          ayuda="Opcional"
          maxLength={500}
          error={errores['notas']}
        />

        {aviso && <Aviso tono="error">{aviso}</Aviso>}

        <div className="flex items-center gap-3 pt-2">
          <button type="submit" className="btn btn-primary" disabled={enviando}>
            {esNuevo ? 'Crear proveedor' : 'Guardar cambios'}
          </button>
          <Link to={volver} className="btn btn-ghost">
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}
