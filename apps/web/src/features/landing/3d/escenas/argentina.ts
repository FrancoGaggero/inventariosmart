// "Hecho para Argentina" (landing-3d D5): el mapa extruido con Malvinas y el sector antártico en un
// recuadro (Ley 26.651), las ciudades de la encuesta y la cinta de inflación frente a tus precios
// con datos de ejemplo.
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  ConeGeometry,
  DoubleSide,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  Object3D,
  Path,
  PlaneGeometry,
  RingGeometry,
  Shape,
  SphereGeometry,
} from 'three';
import { indicesHasta, relleno } from '../cinta';
import type { PaletaEscena } from '../colores';
import { ANTARTIDA, ATLANTICO_SUR, CONTINENTE, type Poligono } from '../datos/argentina';
import { IPC_EJEMPLO, MESES_EJEMPLO, PRECIOS_EJEMPLO } from '../datos/inflacionEjemplo';
import { suavizar, tramo } from '../disposicion';
import { arrancar, type CrearEscena } from '../motor/motor';
import type { Iniciar } from '../progreso';
import { type LonLat, type Punto, proyectar, proyectarPolar } from '../proyeccion';
import { distanciaPara, liberar, luces } from './comun';

/** Ciudades de la muestra de la encuesta (n = 24, marzo de 2026). */
export const CIUDADES: { nombre: string; lugar: LonLat }[] = [
  { nombre: 'AMBA', lugar: [-58.38, -34.6] },
  { nombre: 'Córdoba', lugar: [-64.18, -31.42] },
  { nombre: 'Rosario', lugar: [-60.64, -32.95] },
  { nombre: 'Mendoza', lugar: [-68.83, -32.89] },
];

const PROFUNDIDAD = 0.12;

function formas(lista: Poligono[], proyeccion: (p: LonLat) => Punto): Shape[] {
  return lista.map((pol) => {
    const [borde, ...huecos] = pol.map((anillo) => anillo.map(proyeccion));
    const forma = new Shape();
    borde!.forEach(([x, y], i) => (i === 0 ? forma.moveTo(x, y) : forma.lineTo(x, y)));
    for (const h of huecos) {
      const camino = new Path();
      h.forEach(([x, y], i) => (i === 0 ? camino.moveTo(x, y) : camino.lineTo(x, y)));
      forma.holes.push(camino);
    }
    return forma;
  });
}

function extruir(lista: Shape[]): ExtrudeGeometry {
  return new ExtrudeGeometry(lista, {
    depth: PROFUNDIDAD,
    bevelEnabled: true,
    bevelThickness: 0.01,
    bevelSize: 0.008,
    bevelSegments: 1,
    curveSegments: 1,
  });
}

function geometriaDe(t: { posiciones: Float32Array; indices: Uint16Array }): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(t.posiciones, 3));
  g.setIndex(new BufferAttribute(t.indices, 1));
  g.computeVertexNormals();
  return g;
}

const crear: CrearEscena = ({ escena, camara }, { calidad, paleta: inicial, quieta }) => {
  const completa = calidad === 'completa';
  const raiz = new Group();
  escena.add(raiz);
  const luz = luces(escena, inicial);

  // Mapa principal: cara de arriba (grupo 0) y laterales (grupo 1) con materiales distintos.
  const matCara = new MeshLambertMaterial();
  const matLado = new MeshLambertMaterial();
  const mapa = new Group();
  const pais = new Mesh(extruir(formas(CONTINENTE, proyectar)), [matCara, matLado]);
  mapa.add(pais);

  // Recuadro: sector antártico, Georgias y Sandwich del Sur en proyección polar.
  const recuadro = new Group();
  const polar = new Mesh(
    extruir([...formas(ANTARTIDA, proyectarPolar), ...formas(ATLANTICO_SUR, proyectarPolar)]),
    [matCara, matLado],
  );
  recuadro.add(polar);
  const matMarco = new LineBasicMaterial({ transparent: true, opacity: 0.6 });
  const marco = new LineSegments(new EdgesGeometry(new PlaneGeometry(1.9, 1.9)), matMarco);
  marco.position.set(0, 0.75, PROFUNDIDAD);
  recuadro.add(marco);
  recuadro.scale.setScalar(0.62);
  recuadro.position.set(1.05, -2.15, 0);
  mapa.add(recuadro);

  // Ciudades: un cono que apunta al lugar, con una esfera arriba y un anillo que pulsa.
  const matPunto = new MeshLambertMaterial();
  const conos = new InstancedMesh(
    new ConeGeometry(0.06, 0.22, completa ? 12 : 8),
    matPunto,
    CIUDADES.length,
  );
  const bolas = new InstancedMesh(
    new SphereGeometry(0.075, completa ? 16 : 8, completa ? 12 : 6),
    matPunto,
    CIUDADES.length,
  );
  const matPulso = new MeshBasicMaterial({
    transparent: true,
    side: DoubleSide,
    depthWrite: false,
  });
  const pulsos = new InstancedMesh(new RingGeometry(0.08, 0.1, 24), matPulso, CIUDADES.length);
  mapa.add(conos, bolas, pulsos);
  const lugares = CIUDADES.map((c) => proyectar(c.lugar));

  mapa.scale.setScalar(0.72);
  mapa.position.set(-1.25, 0.15, 0);
  raiz.add(mapa);

  // Cinta: IPC arriba en terracota, tus precios en ámbar y la franja del atraso entre las dos.
  const minimo = 98;
  const maximo = Math.max(...IPC_EJEMPLO) + 2;
  const base = { largo: 2.4, alto: 1.9, minimo, maximo, ancho: 0.07 };
  // Cada serie es una cinta con grosor vertical, para que se lea de frente como una línea.
  const grosor = (maximo - minimo) * 0.022;
  const linea = (serie: number[], z: number) =>
    geometriaDe(
      relleno(
        serie.map((v) => v - grosor),
        serie.map((v) => v + grosor),
        { ...base, z },
      ),
    );
  const cintaIpc = new Mesh(linea(IPC_EJEMPLO, 0.03), new MeshBasicMaterial({ side: DoubleSide }));
  const cintaPrecios = new Mesh(
    linea(PRECIOS_EJEMPLO, 0.05),
    new MeshBasicMaterial({ side: DoubleSide }),
  );
  const franja = new Mesh(
    geometriaDe(relleno(PRECIOS_EJEMPLO, IPC_EJEMPLO, { ...base, z: 0 })),
    new MeshBasicMaterial({
      side: DoubleSide,
      transparent: true,
      opacity: 0.18,
      depthWrite: false,
    }),
  );
  const cinta = new Group();
  cinta.add(franja, cintaIpc, cintaPrecios);
  // La cinta va fuera de la inclinación del mapa: se lee de frente, como un gráfico.
  cinta.position.set(1.55, -0.75, 0.2);
  cinta.rotation.set(-0.12, -0.28, 0);
  escena.add(cinta);
  const tramos = MESES_EJEMPLO - 1;

  function setPaleta(p: PaletaEscena) {
    matCara.color.set(p.card2).lerp(new Color(p.brand), 0.35);
    matLado.color.set(p.brand3).lerp(new Color(p.bg), 0.45);
    matMarco.color.set(p.t3);
    matPunto.color.set(p.ok);
    matPulso.color.set(p.ok);
    (cintaIpc.material as MeshBasicMaterial).color.set(p.warn);
    (cintaPrecios.material as MeshBasicMaterial).color.set(p.brand);
    (franja.material as MeshBasicMaterial).color.set(p.crit);
    luz.setPaleta(p);
    ultimo = -1;
  }

  const aux = new Object3D();
  let ultimo = -1;
  let ultimoAspecto = 0;
  let reloj = quieta ? 10 : 0;
  let llegaron = false;
  setPaleta(inicial);

  function ubicar(p: number) {
    // El mapa crece desde plano y la cámara pasa de cenital a tres cuartos.
    const crece = suavizar(tramo(p, 0, 0.35));
    pais.scale.z = Math.max(crece, 0.02);
    polar.scale.z = Math.max(crece, 0.02);
    const inclina = suavizar(tramo(p, 0.05, 0.6));
    raiz.rotation.x = -inclina * 0.55;
    raiz.rotation.y = (p - 0.5) * 0.2;

    // Las ciudades caen en secuencia; el anillo pulsa tres veces después de llegar.
    const caida = tramo(p, 0.3, 0.65);
    llegaron = caida >= 1;
    lugares.forEach(([x, y], i) => {
      const k = suavizar(tramo(caida, i * 0.15, i * 0.15 + 0.55));
      const z = PROFUNDIDAD * crece + 0.11 + (1 - k) * 1.4;
      aux.position.set(x, y, z);
      aux.rotation.set(-Math.PI / 2, 0, 0);
      aux.scale.setScalar(Math.max(k * 1.7, 0.0001));
      aux.updateMatrix();
      conos.setMatrixAt(i, aux.matrix);
      aux.position.set(x, y, z + 0.22);
      aux.updateMatrix();
      bolas.setMatrixAt(i, aux.matrix);
      const vuelta = llegaron && reloj < 3 ? reloj % 1 : 1;
      aux.position.set(x, y, PROFUNDIDAD * crece + 0.012);
      aux.rotation.set(0, 0, 0);
      aux.scale.setScalar(llegaron ? 1 + vuelta * 2.2 : 0.0001);
      aux.updateMatrix();
      pulsos.setMatrixAt(i, aux.matrix);
    });
    matPulso.opacity = llegaron && reloj < 3 ? (1 - (reloj % 1)) * 0.6 : 0;
    conos.instanceMatrix.needsUpdate = true;
    bolas.instanceMatrix.needsUpdate = true;
    pulsos.instanceMatrix.needsUpdate = true;

    // La cinta se dibuja mes a mes.
    const avance = tramo(p, 0.45, 0.95);
    const cuantos = indicesHasta(avance, tramos);
    for (const m of [cintaIpc, cintaPrecios, franja]) m.geometry.setDrawRange(0, cuantos);
    cinta.visible = cuantos > 0;
  }

  function encuadrar() {
    const d = distanciaPara(completa ? 6 : 5.4, 4.4, camara.fov, camara.aspect);
    camara.position.set(0.2, 0.2, d);
    camara.lookAt(0.2, -0.1, 0);
  }

  return {
    actualizar(p, dt) {
      if (camara.aspect !== ultimoAspecto) {
        ultimoAspecto = camara.aspect;
        encuadrar();
      }
      let sigue = false;
      if (llegaron && reloj < 3) {
        reloj += dt;
        sigue = true;
        ultimo = -1;
      }
      if (p !== ultimo) {
        ubicar(p);
        ultimo = p;
      }
      return sigue;
    },
    setPaleta,
    dispose() {
      escena.remove(raiz, cinta);
      liberar(raiz);
      liberar(cinta);
    },
  };
};

export const iniciar: Iniciar = (lienzo, opciones) => arrancar(lienzo, crear, opciones);
