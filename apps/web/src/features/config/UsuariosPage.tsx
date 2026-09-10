import {
  InvitacionSchema,
  LIMITES_PLAN,
  ROLES,
  type EstadoUsuario,
  type Rol,
  type Usuario,
} from '@inventariosmart/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { UserPlus } from 'lucide-react';
import { type FormEvent, useState } from 'react';
import { api, desenvolver, ErrorApi, mensajeDe } from '@/lib/api';
import { NOMBRE_ROL, useInvalidarMe, useMe } from '@/lib/me';
import { Aviso } from '@/ui/Aviso';
import { Campo } from '@/ui/Campo';

const USERS_KEY = ['users'] as const;

const ESTADO: Record<EstadoUsuario, { texto: string; clase: string }> = {
  ACTIVO: { texto: 'Activo', clase: 'bg-ok/15 text-ok' },
  INVITADO: { texto: 'Invitado', clase: 'bg-warn/15 text-warn' },
  INACTIVO: { texto: 'Inactivo', clase: 'bg-crit/15 text-crit' },
};

export function UsuariosPage() {
  const me = useMe();
  const qc = useQueryClient();
  const invalidarMe = useInvalidarMe();
  const usuarios = useQuery({
    queryKey: USERS_KEY,
    queryFn: async () => desenvolver(await api.GET('/api/v1/users')),
  });

  const [email, setEmail] = useState('');
  const [rol, setRol] = useState<Rol>('EMPLEADO');
  const [aviso, setAviso] = useState<{ tono: 'error' | 'plan' | 'ok'; texto: string } | null>(null);

  const invitar = useMutation({
    mutationFn: async (body: { email: string; rol: Rol }) =>
      desenvolver(await api.POST('/api/v1/users', { body })),
    onSuccess: (u) => {
      setAviso({
        tono: 'ok',
        texto: `Invitación creada para ${u.email}. Cuando inicie sesión con ese email, entra a tu comercio.`,
      });
      setEmail('');
      void qc.invalidateQueries({ queryKey: USERS_KEY });
    },
    onError: (err) => {
      if (err instanceof ErrorApi && err.es('PLAN_REQUERIDO')) {
        setAviso({ tono: 'plan', texto: `Disponible en el plan PRO. ${err.message}` });
      } else {
        setAviso({ tono: 'error', texto: mensajeDe(err) });
      }
    },
  });

  const actualizar = useMutation({
    mutationFn: async ({ id, ...body }: { id: string; rol?: Rol; activo?: boolean }) =>
      desenvolver(await api.PATCH('/api/v1/users/{id}', { params: { path: { id } }, body })),
    onSuccess: async (u) => {
      setAviso({ tono: 'ok', texto: `${u.email}: cambios guardados.` });
      await qc.invalidateQueries({ queryKey: USERS_KEY });
      await invalidarMe();
    },
    onError: (err) => setAviso({ tono: 'error', texto: mensajeDe(err) }),
  });

  const onInvitar = (e: FormEvent) => {
    e.preventDefault();
    setAviso(null);
    const parsed = InvitacionSchema.safeParse({ email, rol });
    if (!parsed.success) {
      setAviso({ tono: 'error', texto: parsed.error.issues[0]?.message ?? 'Revisá los datos.' });
      return;
    }
    invitar.mutate(parsed.data);
  };

  const plan = me.data?.plan ?? 'FREE';
  const limite = LIMITES_PLAN[plan].usuarios;
  const cantidad = usuarios.data?.length ?? 0;
  const enLimite = limite !== null && cantidad >= limite;

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h1 className="text-2xl font-extrabold tracking-tight">Usuarios</h1>
        <p className="text-t2 text-sm mt-1">
          Quién accede a tu comercio y con qué permisos. Plan{' '}
          <span className="font-mono text-brand-3">{plan}</span>
          {limite !== null
            ? ` · ${cantidad} de ${limite} usuario${limite === 1 ? '' : 's'}`
            : ` · ${cantidad} usuarios`}
        </p>
      </header>

      <section className="card p-5">
        <h2 className="font-bold mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-brand-3" aria-hidden />
          Invitar a alguien
        </h2>
        <form
          onSubmit={onInvitar}
          className="grid gap-4 md:grid-cols-[1fr_180px_auto] items-end"
          noValidate
        >
          <Campo
            label="Email"
            type="email"
            value={email}
            onChange={setEmail}
            placeholder="ana@tucomercio.com"
          />
          <label className="block">
            <span className="block text-xs font-semibold text-t2 mb-1.5">Rol</span>
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
              className="w-full rounded-xl bg-[#070C16] border border-white/12 px-4 py-3 text-sm outline-none focus:border-brand-2"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {NOMBRE_ROL[r]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn-primary" disabled={invitar.isPending}>
            Invitar
          </button>
        </form>
        <p className="text-xs text-t3 mt-3">
          Dueño: acceso total. Empleado: catálogo y movimientos, sin costos ni márgenes. Contador:
          sólo lectura de reportes.
        </p>
        {enLimite && !aviso && (
          <div className="mt-3">
            <Aviso tono="plan">
              Tu plan {plan} admite {limite} usuario. Para invitar a tu equipo pasá al plan PRO.
            </Aviso>
          </div>
        )}
        {aviso && (
          <div className="mt-3">
            <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>
          </div>
        )}
      </section>

      <section className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase tracking-wider text-t3 bg-white/[0.03]">
            <tr>
              <th className="text-left px-5 py-3">Usuario</th>
              <th className="text-left px-3 py-3">Rol</th>
              <th className="text-left px-3 py-3">Estado</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {usuarios.isPending && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-t2">
                  Cargando…
                </td>
              </tr>
            )}
            {usuarios.isError && (
              <tr>
                <td colSpan={4} className="px-5 py-6 text-crit">
                  {mensajeDe(usuarios.error)}
                </td>
              </tr>
            )}
            {usuarios.data?.map((u) => (
              <FilaUsuario
                key={u.id}
                usuario={u}
                esYo={u.id === me.data?.usuario.id}
                ocupado={actualizar.isPending}
                onRol={(nuevo) => actualizar.mutate({ id: u.id, rol: nuevo })}
                onActivo={(activo) => actualizar.mutate({ id: u.id, activo })}
              />
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function FilaUsuario({
  usuario: u,
  esYo,
  ocupado,
  onRol,
  onActivo,
}: {
  usuario: Usuario;
  esYo: boolean;
  ocupado: boolean;
  onRol: (rol: Rol) => void;
  onActivo: (activo: boolean) => void;
}) {
  const estado = ESTADO[u.estado];
  return (
    <tr className="border-t border-white/6">
      <td className="px-5 py-3">
        <div className="font-semibold">{u.nombre ?? u.email}</div>
        <div className="text-xs text-t2">
          {u.email}
          {esYo && <span className="ml-2 text-brand-3">(vos)</span>}
        </div>
      </td>
      <td className="px-3 py-3">
        <select
          value={u.rol}
          disabled={ocupado}
          onChange={(e) => onRol(e.target.value as Rol)}
          className="rounded-lg bg-[#070C16] border border-white/12 px-2 py-1.5 text-sm"
          aria-label={`Rol de ${u.email}`}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {NOMBRE_ROL[r]}
            </option>
          ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <span className={`text-xs font-bold px-2 py-1 rounded-full ${estado.clase}`}>
          {estado.texto}
        </span>
      </td>
      <td className="px-5 py-3 text-right">
        {u.activo ? (
          <button
            type="button"
            className="text-xs font-semibold text-crit hover:underline"
            disabled={ocupado}
            onClick={() => onActivo(false)}
          >
            Dar de baja
          </button>
        ) : (
          <button
            type="button"
            className="text-xs font-semibold text-ok hover:underline"
            disabled={ocupado}
            onClick={() => onActivo(true)}
          >
            Reactivar
          </button>
        )}
      </td>
    </tr>
  );
}
