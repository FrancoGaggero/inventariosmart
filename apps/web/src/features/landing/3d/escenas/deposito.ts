// Hero "depósito vivo" (landing-3d D3): cajas en estanterías que, con el scroll, vuelan al gráfico
// de barras del panel y después a la curva de margen.
import {
  BoxGeometry,
  Color,
  Group,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { PaletaEscena } from '../colores';
import {
  ALTO_NIVEL,
  ANCHO_MUEBLE,
  ESTANTERIAS,
  LADO_CAJA,
  barras,
  curva,
  escalonar,
  estanterias,
  tramo,
} from '../disposicion';
import { arrancar, type CrearEscena } from '../motor/motor';
import type { Iniciar } from '../progreso';
import { acercar, distanciaPara, liberar, luces, texturaSombra } from './comun';

export const CAJAS = { completa: 160, liviana: 64 } as const;

const crear: CrearEscena = ({ escena, camara }, { calidad, paleta: inicial, quieta }) => {
  const n = CAJAS[calidad];
  const mueble = ESTANTERIAS[calidad];
  const desde = estanterias(n, mueble);
  const medio = barras(n);
  const hasta = curva(n);
  const raiz = new Group();
  escena.add(raiz);
  const luz = luces(escena, inicial);

  // Cajas y, en la versión completa, la cinta de embalar con las mismas matrices.
  const geoCaja =
    calidad === 'completa'
      ? new RoundedBoxGeometry(LADO_CAJA, LADO_CAJA, LADO_CAJA, 2, 0.025)
      : new BoxGeometry(LADO_CAJA, LADO_CAJA, LADO_CAJA);
  const matCaja = new MeshLambertMaterial();
  const cajas = new InstancedMesh(geoCaja, matCaja, n);
  raiz.add(cajas);
  const cinta =
    calidad === 'completa'
      ? new InstancedMesh(
          new BoxGeometry(LADO_CAJA * 0.24, LADO_CAJA * 1.03, LADO_CAJA * 1.03),
          new MeshLambertMaterial({ transparent: true, opacity: 0.85 }),
          n,
        )
      : null;
  if (cinta) raiz.add(cinta);

  // Estructura de las estanterías: parantes y tablas en un solo InstancedMesh.
  const piezas: [Vector3, Vector3][] = [];
  for (let m = 0; m < mueble.muebles; m++) {
    const x0 = (m - (mueble.muebles - 1) / 2) * (ANCHO_MUEBLE + 0.25);
    const alto = mueble.niveles * ALTO_NIVEL + 0.05;
    for (const lado of [-1, 1]) {
      piezas.push([
        new Vector3(x0 + lado * (ANCHO_MUEBLE / 2 + 0.03), alto / 2, 0),
        new Vector3(0.04, alto, 0.34),
      ]);
    }
    for (let k = 0; k <= mueble.niveles; k++) {
      piezas.push([
        new Vector3(x0, k * ALTO_NIVEL + 0.015, 0),
        new Vector3(ANCHO_MUEBLE + 0.1, 0.03, 0.34),
      ]);
    }
  }
  const matMueble = new MeshLambertMaterial({ transparent: true });
  const muebles = new InstancedMesh(new BoxGeometry(1, 1, 1), matMueble, piezas.length);
  const aux = new Object3D();
  piezas.forEach(([p, s], i) => {
    aux.position.copy(p);
    aux.scale.copy(s);
    aux.rotation.set(0, 0, 0);
    aux.updateMatrix();
    muebles.setMatrixAt(i, aux.matrix);
  });
  raiz.add(muebles);

  const piso = new Mesh(
    new PlaneGeometry(9, 3.2),
    new MeshBasicMaterial({ map: texturaSombra(), transparent: true, depthWrite: false }),
  );
  piso.rotation.x = -Math.PI / 2;
  piso.position.y = 0.001;
  raiz.add(piso);

  // Colores: cada caja tiene su tono de cartón; en el gráfico van en ámbar y en la curva, en verde.
  const tonos: Color[] = [];
  const colorBarra = new Color();
  const colorCurva = new Color();
  const colorCinta = new Color();
  function setPaleta(p: PaletaEscena) {
    const opciones = [new Color(p.brand), new Color(p.brand2), new Color(p.brand3)];
    tonos.length = 0;
    for (let i = 0; i < n; i++)
      tonos.push(opciones[(i * 7) % 3]!.clone().lerp(new Color(p.card2), (i % 5) * 0.04));
    colorBarra.set(p.brand);
    colorCurva.set(p.ok);
    colorCinta.set(p.t1);
    matMueble.color.set(p.t3);
    luz.setPaleta(p);
    sucio = true;
  }

  const objetivo = new Vector3(0, 0.95, 0);
  const giro = { v: 0 };
  const inclinacion = { v: 0 };
  let punteroX = 0;
  let punteroY = 0;
  let intro = quieta ? 10 : 0;
  let ultimoP = -1;
  let ultimoAspecto = 0;
  let sucio = true;
  const color = new Color();
  setPaleta(inicial);

  // El panel del hero tapa el centro y la parte de abajo del lienzo: el depósito se corre hacia
  // arriba (y a la derecha en la compu) con un desplazamiento de vista, sin mover la cámara.
  const centro =
    calidad === 'completa' ? { x: 0.54, y: 0.34, zoom: 1.28 } : { x: 0.5, y: 0.26, zoom: 1.3 };
  function encuadrar() {
    const ancho = calidad === 'completa' ? 6.4 : 5.4;
    const d = distanciaPara(ancho, 3.4, camara.fov, camara.aspect) * centro.zoom;
    const w = 1000;
    const h = w / camara.aspect;
    camara.setViewOffset(w, h, (0.5 - centro.x) * w, (0.5 - centro.y) * h, w, h);
    const yaw = (giro.v * Math.PI) / 180;
    const pitch = 0.32 + (inclinacion.v * Math.PI) / 180;
    camara.position.set(
      objetivo.x + d * Math.sin(yaw) * Math.cos(pitch),
      objetivo.y + d * Math.sin(pitch),
      objetivo.z + d * Math.cos(yaw) * Math.cos(pitch),
    );
    camara.lookAt(objetivo);
  }

  function ubicar(p: number) {
    const tA = tramo(p, 0.1, 0.5);
    const tB = tramo(p, 0.6, 0.95);
    for (let i = 0; i < n; i++) {
      const k = tB > 0 ? escalonar(tB, i, n) : escalonar(tA, i, n);
      const a = tB > 0 ? medio : desde;
      const b = tB > 0 ? hasta : medio;
      const ix = i * 3;
      const arco = Math.sin(Math.PI * k) * 0.55;
      let y = a.pos[ix + 1]! + (b.pos[ix + 1]! - a.pos[ix + 1]!) * k + arco;
      // Entrada: las cajas caen escalonadas a su lugar en 1,2 s.
      if (intro < 1.2) {
        const caida = Math.min(1, Math.max(0, (intro - (i / n) * 0.6) / 0.6));
        y += (1 - caida * caida) * 2.4;
      }
      aux.position.set(
        a.pos[ix]! + (b.pos[ix]! - a.pos[ix]!) * k,
        y,
        a.pos[ix + 2]! + (b.pos[ix + 2]! - a.pos[ix + 2]!) * k,
      );
      aux.rotation.set(0, 0, a.giro[i]! + (b.giro[i]! - a.giro[i]!) * k);
      aux.scale.setScalar(a.escala[i]! + (b.escala[i]! - a.escala[i]!) * k);
      aux.updateMatrix();
      cajas.setMatrixAt(i, aux.matrix);
      cinta?.setMatrixAt(i, aux.matrix);
      if (tB > 0) color.copy(colorBarra).lerp(colorCurva, k);
      else color.copy(tonos[i]!).lerp(colorBarra, k);
      cajas.setColorAt(i, color);
      cinta?.setColorAt(i, colorCinta);
    }
    cajas.instanceMatrix.needsUpdate = true;
    if (cajas.instanceColor) cajas.instanceColor.needsUpdate = true;
    if (cinta) {
      cinta.instanceMatrix.needsUpdate = true;
      if (cinta.instanceColor) cinta.instanceColor.needsUpdate = true;
      (cinta.material as MeshLambertMaterial).opacity = 0.85 * (1 - tB);
      cinta.visible = tB < 1;
    }
    const opacidad = 1 - tramo(p, 0.15, 0.45);
    matMueble.opacity = opacidad;
    matMueble.depthWrite = opacidad >= 1;
    muebles.visible = opacidad > 0;
  }

  return {
    actualizar(p, dt) {
      let sigue = false;
      if (intro < 1.2) {
        intro += dt;
        sigue = true;
        sucio = true;
      }
      const camaraSigue =
        acercar(giro, punteroX * 5, dt, 4) || acercar(inclinacion, -punteroY * 3, dt, 4);
      if (camaraSigue || camara.aspect !== ultimoAspecto) {
        ultimoAspecto = camara.aspect;
        encuadrar();
      }
      if (sucio || p !== ultimoP) {
        ubicar(p);
        ultimoP = p;
        sucio = false;
      }
      return sigue || camaraSigue;
    },
    setPaleta,
    setPuntero(x, y) {
      punteroX = x;
      punteroY = y;
    },
    dispose() {
      escena.remove(raiz);
      liberar(raiz);
    },
  };
};

export const iniciar: Iniciar = (lienzo, opciones) => arrancar(lienzo, crear, opciones);
