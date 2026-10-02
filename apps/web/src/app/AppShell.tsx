import { planCumple } from '@inventariosmart/shared';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router';
import { useResumenAlertas } from '@/lib/alertas';
import { useAuth } from '@/lib/auth';
import { NOMBRE_ROL, useMe } from '@/lib/me';
import { accesosInferiores, seccionesDeNavegacion } from '@/lib/navegacion';
import { useTema } from '@/lib/tema';
import { Confirmar } from '@/ui/Confirmar';
import { BarraInferior } from './BarraInferior';
import { BarraLateral, type DatosNav } from './BarraLateral';
import { BarraSuperior } from './BarraSuperior';
import { PanelNavegacion } from './PanelNavegacion';

const CLAVE_COLAPSO = 'barra-colapsada';

/** Preferencia guardada; la primera vez, riel hasta 1280 px y barra expandida desde `xl` (D4). */
function colapsoInicial(): boolean {
  try {
    const v = localStorage.getItem(CLAVE_COLAPSO);
    if (v === '1' || v === '0') return v === '1';
  } catch {
    // Sin almacenamiento: se decide por el ancho.
  }
  return typeof window !== 'undefined' && window.innerWidth < 1280;
}

/**
 * Armazón de las pantallas privadas (web-redesign, design D4): barra lateral desde `md`, barra
 * superior con la acción principal y, en el celular, barra inferior con "Más".
 */
export function AppShell() {
  const { logout, user } = useAuth();
  const me = useMe();
  const { tema, alternar } = useTema();
  const location = useLocation();
  const rol = me.data?.rol ?? 'EMPLEADO';
  const plan = me.data?.plan ?? 'FREE';
  const conAlertas = (rol === 'DUENIO' || rol === 'CONTADOR') && planCumple(plan, 'PRO');
  const resumen = useResumenAlertas(conAlertas);
  const alertas = {
    activas: conAlertas ? (resumen.data?.activas ?? 0) : 0,
    criticas: conAlertas ? (resumen.data?.criticas ?? 0) : 0,
  };

  const [colapsada, setColapsada] = useState(colapsoInicial);
  const alternarColapso = () =>
    setColapsada((c) => {
      try {
        localStorage.setItem(CLAVE_COLAPSO, c ? '0' : '1');
      } catch {
        // Sin almacenamiento: dura la sesión.
      }
      return !c;
    });

  const [masAbierto, setMasAbierto] = useState(false);
  const botonMas = useRef<HTMLButtonElement>(null);
  const cerrarMas = useCallback(() => setMasAbierto(false), []);
  useEffect(() => {
    setMasAbierto(false);
  }, [location.pathname]);

  // Cerrar sesión pide confirmación: un clic sin querer no debe echar al usuario.
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  const secciones = useMemo(() => seccionesDeNavegacion({ rol, plan }), [rol, plan]);
  const accesos = useMemo(() => accesosInferiores({ rol, plan }), [rol, plan]);
  const datos: DatosNav = {
    secciones,
    alertas,
    comercio: me.data?.comercio.nombre ?? '',
    rol: me.data ? NOMBRE_ROL[me.data.rol] : '',
    plan,
    puedeMejorarPlan: rol === 'DUENIO',
    email: me.data?.usuario.email ?? user?.email ?? '',
    tema,
    alternarTema: alternar,
    salir: () => setConfirmarSalida(true),
  };

  return (
    <div className="min-h-full flex">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 btn btn-primary"
      >
        Ir al contenido
      </a>

      <BarraLateral datos={datos} colapsada={colapsada} alternarColapso={alternarColapso} />

      <div className="flex-1 min-w-0 flex flex-col">
        <BarraSuperior
          alertas={alertas}
          conAlertas={conAlertas}
          puedeRegistrar={rol === 'DUENIO' || rol === 'EMPLEADO'}
        />
        <main
          id="contenido"
          tabIndex={-1}
          className="flex-1 w-full max-w-6xl mx-auto px-4 pt-5 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-8 min-w-0 outline-none"
        >
          <Outlet />
        </main>
      </div>

      <BarraInferior
        accesos={accesos}
        alertas={alertas}
        abrirMas={() => setMasAbierto(true)}
        masAbierto={masAbierto}
        botonMas={botonMas}
      />
      {masAbierto && <PanelNavegacion datos={datos} cerrar={cerrarMas} volverA={botonMas} />}

      <Confirmar
        abierto={confirmarSalida}
        titulo="¿Cerrar sesión?"
        textoConfirmar="Cerrar sesión"
        textoCancelar="Seguir acá"
        peligroso
        onConfirmar={() => {
          setConfirmarSalida(false);
          void logout();
        }}
        onCancelar={() => setConfirmarSalida(false)}
      >
        Vas a salir de {me.data?.comercio.nombre ?? 'InventarioSmart'}. Podés volver a entrar cuando
        quieras.
      </Confirmar>
    </div>
  );
}
