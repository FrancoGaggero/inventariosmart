// "Cómo funciona" en 3D (landing-3d D4): la planilla se vuelve cajas, el stock baja con las ventas,
// salta la alerta en el punto de reposición (RN-04) y sale la orden; el estante se repone.
import {
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  InstancedMesh,
  LatheGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  PlaneGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
} from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import type { PaletaEscena } from '../colores';
import { suavizar, tramo } from '../disposicion';
import { arrancar, type CrearEscena } from '../motor/motor';
import { estadoDePaso } from '../pasos3d';
import type { Iniciar } from '../progreso';
import { distanciaPara, liberar, luces, texturaSombra } from './comun';

const PASOS = 4;
const STOCK_INICIAL = 24;
const STOCK_MINIMO = 6;
const PUNTO_REPOSICION = 8;
const LADO = 0.2;

function texturaPlanilla(p: PaletaEscena): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 192;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = p.card;
    g.fillRect(0, 0, 256, 192);
    g.strokeStyle = p.t3;
    g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 42) g.strokeRect(x, 0, 0.5, 192);
    for (let y = 0; y <= 192; y += 24) g.strokeRect(0, y, 256, 0.5);
    g.fillStyle = p.ok;
    g.fillRect(0, 0, 256, 24);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Avión de papel genérico, de cuatro triángulos. No es el logo de WhatsApp. */
function avion(): BufferGeometry {
  const g = new BufferGeometry();
  // prettier-ignore
  const v = [
    0, 0, 0.5,  -0.32, 0, -0.3,  0, 0.04, -0.12,
    0, 0, 0.5,  0, 0.04, -0.12,  0.32, 0, -0.3,
    0, 0, 0.5,  0, 0.04, -0.12,  0, -0.12, -0.18,
    0, 0, 0.5,  0, -0.12, -0.18, 0, 0.04, -0.12,
  ];
  g.setAttribute('position', new Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/** Perfil de la campana de alerta, girado con LatheGeometry. */
function campana(): LatheGeometry {
  const perfil = [
    [0, 0.42],
    [0.06, 0.4],
    [0.12, 0.33],
    [0.15, 0.2],
    [0.17, 0.08],
    [0.24, 0.0],
    [0.24, -0.03],
    [0, -0.03],
  ].map(([x, y]) => new Vector2(x, y));
  return new LatheGeometry(perfil, 18);
}

const crear: CrearEscena = ({ escena, camara }, { calidad, paleta: inicial }) => {
  const completa = calidad === 'completa';
  const raiz = new Group();
  escena.add(raiz);
  const luz = luces(escena, inicial);
  const aux = new Object3D();

  // Estante: 3 niveles de 8 lugares.
  const slots: Vector3[] = [];
  for (let nivel = 0; nivel < 3; nivel++) {
    for (let k = 0; k < 8; k++) slots.push(new Vector3(-0.95 + k * 0.235, 0.14 + nivel * 0.4, 0));
  }
  const matMueble = new MeshLambertMaterial();
  const mueble = new InstancedMesh(new BoxGeometry(1, 1, 1), matMueble, 6);
  const piezas: [number, number, number, number, number][] = [
    [-0.12, 0.6, 2.05, 0.03, 0.3],
    [-0.12, 1.0, 2.05, 0.03, 0.3],
    [-0.12, 0.2, 2.05, 0.03, 0.3],
    [-0.12, 0.02, 2.05, 0.03, 0.3],
    [-1.17, 0.6, 0.04, 1.2, 0.3],
    [0.93, 0.6, 0.04, 1.2, 0.3],
  ];
  piezas.forEach(([x, y, sx, sy, sz], i) => {
    aux.position.set(x, y - 0.05, 0);
    aux.scale.set(sx, sy, sz);
    aux.updateMatrix();
    mueble.setMatrixAt(i, aux.matrix);
  });
  raiz.add(mueble);

  // Planilla de la que salen las cajas.
  const matPlanilla = new MeshBasicMaterial({ map: texturaPlanilla(inicial), transparent: true });
  const planilla = new Mesh(new PlaneGeometry(1.3, 0.98), matPlanilla);
  planilla.position.set(-1.95, 0.8, 0.2);
  planilla.rotation.set(-0.3, 0.45, 0.06);
  raiz.add(planilla);

  const geoCaja = completa
    ? new RoundedBoxGeometry(LADO, LADO, LADO, 2, 0.02)
    : new BoxGeometry(LADO, LADO, LADO);
  const matCaja = new MeshLambertMaterial();
  const cajas = new InstancedMesh(geoCaja, matCaja, STOCK_INICIAL);
  raiz.add(cajas);

  // Mostrador: un celular con la pantalla encendida.
  const matCel = new MeshLambertMaterial();
  const celular = new Mesh(new RoundedBoxGeometry(0.46, 0.84, 0.06, 2, 0.05), matCel);
  celular.position.set(1.85, 0.62, 0.1);
  celular.rotation.y = -0.35;
  const matPantalla = new MeshBasicMaterial();
  const pantalla = new Mesh(new PlaneGeometry(0.38, 0.7), matPantalla);
  pantalla.position.z = 0.032;
  celular.add(pantalla);
  raiz.add(celular);

  // Medidor de stock con el anillo del punto de reposición (RN-04).
  const ALTO_MEDIDOR = 1.4;
  const matMedidor = new MeshLambertMaterial();
  const medidor = new Mesh(new CylinderGeometry(0.11, 0.11, 1, completa ? 24 : 12), matMedidor);
  medidor.position.set(1.15, 0, 0);
  const tubo = new Mesh(
    new CylinderGeometry(0.15, 0.15, ALTO_MEDIDOR, completa ? 24 : 12, 1, true),
    new MeshBasicMaterial({
      transparent: true,
      opacity: 0.18,
      side: DoubleSide,
      depthWrite: false,
    }),
  );
  tubo.position.set(1.15, ALTO_MEDIDOR / 2, 0);
  const matAnillo = new MeshBasicMaterial();
  const anillo = new Mesh(new TorusGeometry(0.19, 0.018, 8, completa ? 36 : 20), matAnillo);
  anillo.rotation.x = Math.PI / 2;
  anillo.position.set(1.15, (PUNTO_REPOSICION / STOCK_INICIAL) * ALTO_MEDIDOR, 0);
  raiz.add(medidor, tubo, anillo);

  const matCampana = new MeshLambertMaterial();
  const bell = new Mesh(campana(), matCampana);
  bell.position.set(1.15, ALTO_MEDIDOR + 0.32, 0);
  const matPulso = new MeshBasicMaterial({ transparent: true, depthWrite: false });
  const pulso = new Mesh(new TorusGeometry(0.3, 0.012, 6, 32), matPulso);
  pulso.position.copy(bell.position);
  raiz.add(bell, pulso);

  const matAvion = new MeshLambertMaterial({ side: DoubleSide });
  const plane = new Mesh(avion(), matAvion);
  plane.scale.setScalar(0.55);
  raiz.add(plane);

  const piso = new Mesh(
    new PlaneGeometry(7, 2.6),
    new MeshBasicMaterial({ map: texturaSombra(), transparent: true, depthWrite: false }),
  );
  piso.rotation.x = -Math.PI / 2;
  raiz.add(piso);

  const colores = { caja: new Color(), ok: new Color(), warn: new Color() };
  let tonos: Color[] = [];
  let paletaActual = inicial;
  function setPaleta(p: PaletaEscena) {
    paletaActual = p;
    const op = [new Color(p.brand), new Color(p.brand2), new Color(p.brand3)];
    tonos = Array.from({ length: STOCK_INICIAL }, (_, i) => op[(i * 5) % 3]!);
    colores.ok.set(p.ok);
    colores.warn.set(p.warn);
    matMueble.color.set(p.t3);
    matCel.color.set(p.card2);
    matPantalla.color.set(p.brand);
    matCampana.color.set(p.warn);
    matPulso.color.set(p.warn);
    matAnillo.color.set(p.warn);
    matAvion.color.set(p.whatsapp);
    (tubo.material as MeshBasicMaterial).color.set(p.t3);
    matPlanilla.map?.dispose();
    matPlanilla.map = texturaPlanilla(p);
    matPlanilla.needsUpdate = true;
    luz.setPaleta(p);
    ultimo = -1;
  }

  const origen = new Vector3();
  const destino = new Vector3();
  const color = new Color();
  let ultimo = -1;
  let ultimoAspecto = 0;
  setPaleta(inicial);

  function ubicar(p: number) {
    const estado = estadoDePaso(p, PASOS);
    const s = (i: number) => Math.min(1, Math.max(0, p * PASOS - i));
    const s0 = s(0);
    const s1 = s(1);
    const s2 = s(2);
    const s3 = s(3);
    const vendidas = (STOCK_INICIAL - STOCK_MINIMO) * s1;
    const repuestas = (STOCK_INICIAL - STOCK_MINIMO) * tramo(s3, 0.45, 1);
    const stock = STOCK_INICIAL - vendidas + repuestas;

    planilla.visible = s0 < 1;
    matPlanilla.opacity = 1 - tramo(s0, 0.7, 1);
    for (let i = 0; i < STOCK_INICIAL; i++) {
      const slot = slots[i]!;
      // Paso 1: salen de la fila de la planilla y vuelan al estante.
      const llegada = suavizar(
        tramo(s0, (i / STOCK_INICIAL) * 0.5, (i / STOCK_INICIAL) * 0.5 + 0.5),
      );
      origen.set(-1.95 + ((i % 6) - 2.5) * 0.17, 1.0 - Math.floor(i / 6) * 0.12, 0.25);
      destino.copy(slot);
      aux.position.lerpVectors(origen, destino, llegada);
      aux.position.y += Math.sin(Math.PI * llegada) * 0.5;
      let escala = 0.3 + 0.7 * llegada;
      // Paso 2: las de arriba se venden de a una hacia el mostrador.
      const turno = STOCK_INICIAL - 1 - i;
      if (turno < STOCK_INICIAL - STOCK_MINIMO) {
        const venta = suavizar(Math.min(1, Math.max(0, vendidas - turno)));
        const vuelta = suavizar(Math.min(1, Math.max(0, repuestas - turno)));
        if (venta > 0 && vuelta === 0) {
          aux.position.lerp(celular.position, venta);
          escala *= 1 - venta;
        } else if (vuelta > 0) {
          // Paso 4: el estante se repone desde arriba.
          aux.position.copy(slot);
          aux.position.y += (1 - vuelta) * 1.2;
          escala = vuelta;
        }
      }
      aux.rotation.set(0, 0, 0);
      aux.scale.setScalar(Math.max(escala, 0.0001));
      aux.updateMatrix();
      cajas.setMatrixAt(i, aux.matrix);
      cajas.setColorAt(i, tonos[i]!);
    }
    cajas.instanceMatrix.needsUpdate = true;
    if (cajas.instanceColor) cajas.instanceColor.needsUpdate = true;

    // Medidor: baja con las ventas, se pone en alerta bajo el punto de reposición y vuelve.
    const alto = Math.max(0.02, (stock / STOCK_INICIAL) * ALTO_MEDIDOR);
    medidor.scale.y = alto;
    medidor.position.y = alto / 2;
    const alerta = stock <= PUNTO_REPOSICION ? 1 : tramo(PUNTO_REPOSICION + 3 - stock, 0, 3);
    color.copy(colores.ok).lerp(colores.warn, alerta);
    matMedidor.color.copy(color);

    // Paso 3: la campana aparece con rebote y el anillo pulsa dos veces; se va al final.
    const entra = tramo(s2, 0, 0.35);
    const rebote =
      entra < 1 ? Math.sin(entra * Math.PI * 0.5) * (1 + 0.25 * Math.sin(entra * Math.PI)) : 1;
    const sale = 1 - tramo(s3, 0.5, 0.8);
    bell.scale.setScalar(Math.max(rebote * sale, 0.0001));
    bell.rotation.z = Math.sin(s2 * Math.PI * 6) * 0.25 * (1 - s2);
    bell.visible = s2 > 0 && sale > 0;
    const vuelta = (s2 * 2) % 1;
    pulso.visible = s2 > 0.05 && s2 < 1 && sale > 0;
    pulso.scale.setScalar(1 + vuelta * 0.8);
    matPulso.opacity = (1 - vuelta) * 0.7;

    // Paso 4: el avión sale del celular por una curva hacia arriba a la derecha.
    const vuelo = suavizar(tramo(s3, 0, 0.75));
    plane.visible = s3 > 0 && vuelo < 1;
    const x = 1.85 + vuelo * 0.95;
    const y = 0.9 + vuelo * 1.25 + Math.sin(vuelo * Math.PI) * 0.35;
    plane.position.set(x, y, 0.3);
    plane.rotation.set(-0.5 + vuelo * 0.3, 0.9, 0.2);

    // El celular se ilumina mientras registra ventas.
    matPantalla.color.set(estado.indice === 1 ? paletaActual.brand2 : paletaActual.brand);
  }

  function encuadrar() {
    const d = distanciaPara(completa ? 6.2 : 6, 2.7, camara.fov, camara.aspect);
    camara.position.set(0.1, 1.5 + d * 0.18, d);
    camara.lookAt(0.1, 0.85, 0);
  }

  return {
    actualizar(p) {
      if (camara.aspect !== ultimoAspecto) {
        ultimoAspecto = camara.aspect;
        encuadrar();
      }
      if (p !== ultimo) {
        ubicar(p);
        ultimo = p;
      }
      return false;
    },
    setPaleta,
    dispose() {
      escena.remove(raiz);
      liberar(raiz);
    },
  };
};

export const iniciar: Iniciar = (lienzo, opciones) => arrancar(lienzo, crear, opciones);
