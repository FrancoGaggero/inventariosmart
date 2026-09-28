import {
  planCumple,
  type AccionAsistente,
  type FuenteAsistente,
  type RolMensaje,
} from '@inventariosmart/shared';
import { Plus, SendHorizontal, ShoppingCart, Sparkles } from 'lucide-react';
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { ErrorApi, mensajeDe } from '@/lib/api';
import {
  AVISO_IA,
  AVISO_PLAN,
  type AvisoAsistente,
  PREGUNTAS_SUGERIDAS,
  avisoDeError,
  bloquesDeTexto,
  contadorDeCaracteres,
  excedeElLargo,
  fechaDeConversacion,
  fraseFuentes,
  puedeEnviar,
  useConversacion,
  useConversaciones,
  useEnviarMensaje,
} from '@/lib/asistente';
import { useMe } from '@/lib/me';
import { Aviso } from '@/ui/Aviso';
import { SkeletonFilas } from '@/ui/Skeleton';

interface MensajeVisible {
  id: string;
  rol: RolMensaje;
  contenido: string;
  fuentes: FuenteAsistente[];
  acciones: AccionAsistente[];
}

function Texto({ contenido }: { contenido: string }) {
  return (
    <div className="space-y-2">
      {bloquesDeTexto(contenido).map((b, i) =>
        b.tipo === 'parrafo' ? (
          <p key={i}>{b.texto}</p>
        ) : (
          <ul key={i} className="list-disc pl-5 space-y-1">
            {b.items.map((item, j) => (
              <li key={j}>{item}</li>
            ))}
          </ul>
        ),
      )}
    </div>
  );
}

function Burbuja({ mensaje }: { mensaje: MensajeVisible }) {
  const propio = mensaje.rol === 'USUARIO';
  return (
    <li className={`entra flex ${propio ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-[88%] md:max-w-[75%] min-w-0 space-y-2`}>
        <div
          className={`rounded-2xl px-4 py-2.5 text-sm break-words ${
            propio
              ? 'bg-brand text-on-brand rounded-br-md whitespace-pre-wrap'
              : 'bg-fill border border-line rounded-bl-md'
          }`}
        >
          <span className="sr-only">{propio ? 'Vos: ' : 'Asistente: '}</span>
          {propio ? mensaje.contenido : <Texto contenido={mensaje.contenido} />}
        </div>
        {mensaje.acciones.map((a) => (
          <Link
            key={a.ordenId}
            to={`/ordenes/${a.ordenId}`}
            className="card card-hover flex items-center gap-3 p-3 text-sm"
          >
            <span className="w-9 h-9 rounded-lg bg-warn/15 text-warn grid place-items-center shrink-0">
              <ShoppingCart className="w-4 h-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">
                Orden {a.numero} para {a.proveedor}
              </span>
              <span className="block text-xs text-t2">
                Borrador. Todavía no se envió: revisala y confirmala.
              </span>
            </span>
          </Link>
        ))}
        {!propio && mensaje.fuentes.length > 0 && (
          <p className="text-xs text-t3 px-1">{fraseFuentes(mensaje.fuentes)}</p>
        )}
      </div>
    </li>
  );
}

/** Asistente conversacional (/asistente, HU-08). Plan PREMIUM, sólo DUENIO. */
export function AsistentePage() {
  const me = useMe();
  const tienePlan = me.data ? planCumple(me.data.plan, 'PREMIUM') : false;
  const [conversacionId, setConversacionId] = useState<string | null>(null);
  // Mensajes de esta sesión, que se suman a los que trajo la conversación al abrirla.
  const [nuevos, setNuevos] = useState<MensajeVisible[]>([]);
  const [texto, setTexto] = useState('');
  const [enCurso, setEnCurso] = useState<string | null>(null);
  const [aviso, setAviso] = useState<AvisoAsistente | null>(null);
  // Una conversación abierta desde el historial trae sus mensajes; una recién creada no.
  const [abiertaDelHistorial, setAbiertaDelHistorial] = useState(false);

  const conversaciones = useConversaciones(tienePlan);
  const detalle = useConversacion(conversacionId, tienePlan && abiertaDelHistorial);
  const enviar = useEnviarMensaje();
  const lista = conversaciones.data?.pages.flatMap((p) => p.items) ?? [];
  const anteriores: MensajeVisible[] = abiertaDelHistorial ? (detalle.data?.mensajes ?? []) : [];
  const mensajes = [...anteriores, ...nuevos];
  const vacia = mensajes.length === 0 && enCurso === null && !detalle.isFetching;

  const final = useRef<HTMLDivElement>(null);
  const campo = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    final.current?.scrollIntoView?.({ block: 'end' });
  }, [mensajes.length, enCurso]);

  const abrir = (id: string | null) => {
    if (enviar.isPending) return;
    setConversacionId(id);
    setAbiertaDelHistorial(id !== null);
    setNuevos([]);
    setAviso(null);
    campo.current?.focus();
  };

  const preguntar = (consulta: string) => {
    const mensaje = consulta.trim();
    if (!puedeEnviar(mensaje, enviar.isPending)) return;
    setAviso(null);
    setEnCurso(mensaje);
    setTexto('');
    enviar.mutate(
      { mensaje, ...(conversacionId ? { conversacionId } : {}) },
      {
        onSuccess: (r) => {
          setConversacionId(r.conversacionId);
          setNuevos((n) => [
            ...n,
            {
              id: `u-${r.mensaje.id}`,
              rol: 'USUARIO',
              contenido: mensaje,
              fuentes: [],
              acciones: [],
            },
            r.mensaje,
          ]);
        },
        onError: (err) => {
          // La consulta vuelve al campo: no se pierde lo escrito.
          setTexto(mensaje);
          setAviso(avisoDeError(err instanceof ErrorApi ? err.status : 0, mensajeDe(err)));
        },
        onSettled: () => {
          setEnCurso(null);
          // El foco vuelve al campo para seguir la conversación.
          campo.current?.focus();
        },
      },
    );
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    preguntar(texto);
  };
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      preguntar(texto);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-3" aria-hidden />
            Asistente
          </h1>
          <p className="text-t2 text-sm mt-1 max-w-2xl">
            Preguntale por tu negocio como se lo preguntarías a una persona.
          </p>
        </div>
        {tienePlan && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => abrir(null)}
            disabled={enviar.isPending || (conversacionId === null && mensajes.length === 0)}
          >
            <Plus className="w-4 h-4" aria-hidden />
            Nueva conversación
          </button>
        )}
      </header>

      {me.data && !tienePlan && <Aviso tono="plan">{AVISO_PLAN}</Aviso>}

      {tienePlan && (
        <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)] items-start">
          <aside className="min-w-0">
            <label className="lg:hidden block">
              <span className="sr-only">Conversaciones anteriores</span>
              <select
                className="campo !py-2.5"
                value={conversacionId ?? ''}
                onChange={(e) => abrir(e.target.value === '' ? null : e.target.value)}
                disabled={enviar.isPending}
              >
                <option value="">Conversación nueva</option>
                {lista.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.titulo}
                  </option>
                ))}
              </select>
            </label>
            <nav className="hidden lg:block card overflow-hidden" aria-label="Conversaciones">
              <h2 className="px-4 py-3 text-xs uppercase tracking-wider text-t3 bg-fill">
                Conversaciones
              </h2>
              {conversaciones.isPending && <SkeletonFilas filas={3} />}
              {conversaciones.isError && (
                <p className="p-4 text-sm text-crit">{mensajeDe(conversaciones.error)}</p>
              )}
              {conversaciones.isSuccess && lista.length === 0 && (
                <p className="p-4 text-sm text-t2">Todavía no hay conversaciones.</p>
              )}
              <ul className="max-h-[60vh] overflow-y-auto">
                {lista.map((c) => (
                  <li key={c.id} className="border-t border-line">
                    <button
                      type="button"
                      onClick={() => abrir(c.id)}
                      disabled={enviar.isPending}
                      aria-current={c.id === conversacionId}
                      className={`w-full text-left px-4 py-2.5 transition ${
                        c.id === conversacionId ? 'bg-brand/15' : 'hover:bg-fill'
                      }`}
                    >
                      <span className="block text-sm font-semibold truncate">{c.titulo}</span>
                      <span className="block text-xs text-t3">
                        {fechaDeConversacion(c.actualizadoEn)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {conversaciones.hasNextPage && (
                <div className="p-2 border-t border-line text-center">
                  <button
                    type="button"
                    className="text-xs font-semibold text-brand-3 hover:underline"
                    onClick={() => void conversaciones.fetchNextPage()}
                    disabled={conversaciones.isFetchingNextPage}
                  >
                    Ver más
                  </button>
                </div>
              )}
            </nav>
          </aside>

          <section className="card flex flex-col min-w-0" aria-label="Conversación">
            <div
              className="flex-1 overflow-y-auto p-4 min-h-[45vh] max-h-[60vh]"
              role="log"
              aria-live="polite"
              aria-busy={enCurso !== null}
            >
              {detalle.isFetching && <SkeletonFilas filas={3} />}
              {detalle.isError && <Aviso tono="error">{mensajeDe(detalle.error)}</Aviso>}
              {vacia && (
                <div className="h-full grid place-items-center text-center py-6">
                  <div className="space-y-4 max-w-md">
                    <p className="font-bold">¿Qué querés saber?</p>
                    <ul className="grid gap-2 sm:grid-cols-2">
                      {PREGUNTAS_SUGERIDAS.map((p) => (
                        <li key={p}>
                          <button
                            type="button"
                            className="chip w-full !whitespace-normal !h-auto !py-2 text-left"
                            onClick={() => preguntar(p)}
                          >
                            {p}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              )}
              <ul className="space-y-3">
                {mensajes.map((m) => (
                  <Burbuja key={m.id} mensaje={m} />
                ))}
                {enCurso !== null && (
                  <>
                    <Burbuja
                      mensaje={{
                        id: 'en-curso',
                        rol: 'USUARIO',
                        contenido: enCurso,
                        fuentes: [],
                        acciones: [],
                      }}
                    />
                    <li className="flex justify-start" role="status">
                      <span className="rounded-2xl rounded-bl-md bg-fill border border-line px-4 py-2.5 text-sm text-t2 pulso">
                        Consultando tus datos…
                      </span>
                    </li>
                  </>
                )}
              </ul>
              <div ref={final} />
            </div>

            <form onSubmit={onSubmit} className="border-t border-line p-3 space-y-2">
              {aviso && <Aviso tono={aviso.tono}>{aviso.texto}</Aviso>}
              <div className="flex items-end gap-2">
                <label className="flex-1 min-w-0">
                  <span className="sr-only">Tu consulta</span>
                  <textarea
                    ref={campo}
                    className="campo resize-none"
                    rows={2}
                    value={texto}
                    onChange={(e) => setTexto(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder="Escribí tu consulta…"
                    aria-invalid={excedeElLargo(texto)}
                    aria-describedby="asistente-contador"
                  />
                </label>
                <button
                  type="submit"
                  className="btn btn-primary !px-3.5"
                  disabled={!puedeEnviar(texto, enviar.isPending)}
                  aria-label="Enviar"
                  title="Enviar"
                >
                  <SendHorizontal className="w-4 h-4" aria-hidden />
                </button>
              </div>
              <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-xs text-t3">
                <span className="max-w-xl">{AVISO_IA}</span>
                <span
                  id="asistente-contador"
                  className={`tabular-nums ${excedeElLargo(texto) ? 'text-crit font-semibold' : ''}`}
                >
                  {contadorDeCaracteres(texto)}
                </span>
              </div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
