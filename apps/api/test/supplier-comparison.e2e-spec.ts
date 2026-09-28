import { randomUUID } from 'node:crypto';
import { type AppDePrueba, conCargaExclusiva, crearAppDePrueba, persona } from './helpers';

interface Comparado {
  proveedor: { id: string; nombre: string };
  costoNeto: string;
  diferenciaPct: string;
  esPrincipal: boolean;
  puntajePrecio: string;
  puntajePlazo: string;
  puntajeConfiabilidad: string;
  puntaje: string;
}

interface Insumo {
  producto: { id: string; codigo: string };
  proveedores: number;
  recomendado: { nombre: string };
  principal: { nombre: string } | null;
  cambiaProveedor: boolean;
  ahorroEstimado: string | null;
}

describe('supplier-comparison: comparador de proveedores (e2e)', () => {
  let t: AppDePrueba;
  const duenioA = persona('duenio-a');
  const duenioB = persona('duenio-b');
  const duenioC = persona('duenio-c');
  const duenioPro = persona('duenio-pro');
  const duenioFree = persona('duenio-free');
  const empleada = persona('empleada');
  const contador = persona('contador');
  const comercio: Record<string, string> = {};
  const usuario: Record<string, string> = {};
  const prod: Record<string, string> = {};
  const prov: Record<string, string> = {};

  const auth = (p: { token: string }) => ({ Authorization: `Bearer ${p.token}` });
  const resumen = (query = '', quien = duenioA) =>
    t.http().get(`/api/v1/supplier-comparison${query}`).set(auth(quien));
  const comparacion = (productoId: string, quien = duenioA) =>
    t.http().get(`/api/v1/products/${productoId}/supplier-comparison`).set(auth(quien));
  const nombres = (proveedores: Comparado[]) => proveedores.map((p) => p.proveedor.nombre);
  const de = (proveedores: Comparado[], nombre: string) =>
    proveedores.find((p) => p.proveedor.nombre === nombre) as Comparado;
  const codigos = (items: Insumo[]) => items.map((i) => i.producto.codigo);
  const insumo = (items: Insumo[], codigo: string) =>
    items.find((i) => i.producto.codigo === codigo) as Insumo;

  const crearProducto = async (codigo: string, quien = duenioA): Promise<string> =>
    (
      await t
        .http()
        .post('/api/v1/products')
        .set(auth(quien))
        .send({
          codigo,
          nombre: `Insumo ${codigo}`,
          precioVenta: 3900,
          costoReposicion: 2100,
          alicuotaIva: 21,
          stockInicial: 100,
        })
        .expect(201)
    ).body.id;

  const crearProveedor = async (
    nombre: string,
    leadTimeDias: number,
    confiabilidad: number,
    quien = duenioA,
  ): Promise<string> =>
    (
      await t
        .http()
        .post('/api/v1/suppliers')
        .set(auth(quien))
        .send({ nombre, leadTimeDias, confiabilidad })
        .expect(201)
    ).body.id;

  const cargar = (proveedorId: string, productoId: string, costoNeto: number, quien = duenioA) =>
    t
      .http()
      .post(`/api/v1/suppliers/${proveedorId}/prices`)
      .set(auth(quien))
      .send({ items: [{ productoId, costoNeto }] })
      .expect(201);

  const editarProveedor = (id: string, body: object, quien = duenioA) =>
    t.http().patch(`/api/v1/suppliers/${id}`).set(auth(quien)).send(body).expect(200);

  beforeAll(async () => {
    t = await crearAppDePrueba();
    for (const [clave, p] of [
      ['a', duenioA],
      ['b', duenioB],
      ['c', duenioC],
      ['pro', duenioPro],
      ['free', duenioFree],
    ] as const) {
      const me = (await t.http().get('/api/v1/me').set(auth(p)).expect(200)).body;
      comercio[clave] = me.comercio.id;
      usuario[clave] = me.usuario.id;
    }
    await t.prisma.comoSistema(async (tx) => {
      await tx.comercio.updateMany({
        where: { id: { in: [comercio['a']!, comercio['b']!, comercio['c']!] } },
        data: { plan: 'PREMIUM' },
      });
      await tx.comercio.update({ where: { id: comercio['pro']! }, data: { plan: 'PRO' } });
    });
    for (const [p, rol] of [
      [empleada, 'EMPLEADO'],
      [contador, 'CONTADOR'],
    ] as const) {
      await t
        .http()
        .post('/api/v1/users')
        .set(auth(duenioA))
        .send({ email: p.email, rol })
        .expect(201);
      await t.http().get('/api/v1/me').set(auth(p)).expect(200);
    }

    // Comercio A: los insumos de CP-12.1 y CP-12.3.
    for (const codigo of ['FA-220', 'AC-5L', 'AM-1L', 'BI-09']) {
      prod[codigo] = await crearProducto(codigo);
    }
    prov['Norte'] = await crearProveedor('Norte', 5, 3);
    prov['Sur'] = await crearProveedor('Sur', 7, 4);
    prov['Este'] = await crearProveedor('Este', 2, 5);
    prov['Oeste'] = await crearProveedor('Oeste', 1, 5);
    // El primero en cargar un costo queda como proveedor principal (RN-08).
    await cargar(prov['Norte']!, prod['FA-220']!, 2340);
    await cargar(prov['Sur']!, prod['FA-220']!, 2200);
    await cargar(prov['Sur']!, prod['FA-220']!, 2000);
    await cargar(prov['Este']!, prod['FA-220']!, 2100);
    await cargar(prov['Oeste']!, prod['FA-220']!, 1500);
    await t.http().delete(`/api/v1/suppliers/${prov['Oeste']}`).set(auth(duenioA)).expect(200);
    await cargar(prov['Este']!, prod['AC-5L']!, 5000);
    await cargar(prov['Norte']!, prod['AC-5L']!, 6000);
    await cargar(prov['Norte']!, prod['AM-1L']!, 800);
    await t
      .http()
      .post('/api/v1/movements')
      .set(auth(duenioA))
      .send({ tipo: 'VENTA', productoId: prod['FA-220'], cantidad: 60 })
      .expect(201);

    // Comercio B: plazo 0, empates, sin principal y sin ventas (CP-12.2b y CP-12.3b).
    for (const codigo of ['P-AB', 'P-CD', 'SP-1', 'SV-1']) {
      prod[codigo] = await crearProducto(codigo, duenioB);
    }
    prov['A'] = await crearProveedor('Prov A', 0, 3, duenioB);
    prov['B'] = await crearProveedor('Prov B', 3, 3, duenioB);
    prov['C'] = await crearProveedor('Prov C', 4, 4, duenioB);
    prov['D'] = await crearProveedor('Prov D', 4, 4, duenioB);
    await cargar(prov['A']!, prod['P-AB']!, 1000, duenioB);
    await cargar(prov['B']!, prod['P-AB']!, 900, duenioB);
    await cargar(prov['D']!, prod['P-CD']!, 1200, duenioB);
    await cargar(prov['C']!, prod['P-CD']!, 1200, duenioB);
    await cargar(prov['A']!, prod['SP-1']!, 1000, duenioB);
    await cargar(prov['B']!, prod['SP-1']!, 900, duenioB);
    await t
      .http()
      .patch(`/api/v1/products/${prod['SP-1']}`)
      .set(auth(duenioB))
      .send({ proveedorPrincipalId: null })
      .expect(200);
    await cargar(prov['A']!, prod['SV-1']!, 1000, duenioB);
    await cargar(prov['B']!, prod['SV-1']!, 500, duenioB);
  }, 300_000);

  afterAll(async () => {
    await t.limpiar();
  }, 120_000);

  describe('comparación de un insumo', () => {
    it('CP-12.1, CP-12.1c y CP-12.2 tres proveedores puntuados, con el último costo de los activos', async () => {
      const r = await comparacion(prod['FA-220']!).expect(200);
      expect(r.body.producto).toMatchObject({ id: prod['FA-220'], codigo: 'FA-220' });
      expect(nombres(r.body.proveedores)).toEqual(['Este', 'Sur', 'Norte']);
      expect(de(r.body.proveedores, 'Este')).toMatchObject({
        costoNeto: '2100.00',
        diferenciaPct: '5.00',
        esPrincipal: false,
        puntajePrecio: '95.24',
        puntajePlazo: '100.00',
        puntajeConfiabilidad: '100.00',
        puntaje: '97.14',
        leadTimeDias: 2,
        confiabilidad: 5,
      });
      expect(de(r.body.proveedores, 'Sur')).toMatchObject({
        costoNeto: '2000.00',
        diferenciaPct: '0.00',
        puntajePrecio: '100.00',
        puntajePlazo: '37.50',
        puntajeConfiabilidad: '80.00',
        puntaje: '81.38',
      });
      expect(de(r.body.proveedores, 'Norte')).toMatchObject({
        costoNeto: '2340.00',
        diferenciaPct: '17.00',
        esPrincipal: true,
        puntajePrecio: '85.47',
        puntajePlazo: '50.00',
        puntajeConfiabilidad: '60.00',
        puntaje: '72.78',
      });
      expect(r.body.recomendado).toMatchObject({ id: prov['Este'], nombre: 'Este' });
      expect(r.body.masBarato).toMatchObject({ id: prov['Sur'], costoNeto: '2000.00' });
      expect(r.body.principal).toMatchObject({ id: prov['Norte'], costoNeto: '2340.00' });
      expect(r.body).toMatchObject({
        comparable: true,
        cambiaProveedor: true,
        unidades30d: 60,
        ahorroEstimado: '14400.00',
      });
      expect(new Date(r.body.proveedores[0].vigenteDesde).getTime()).not.toBeNaN();
    }, 120_000);

    it('CP-12.1b un solo proveedor o ninguno', async () => {
      const uno = await comparacion(prod['AM-1L']!).expect(200);
      expect(uno.body.proveedores).toHaveLength(1);
      expect(uno.body.proveedores[0]).toMatchObject({
        puntajePrecio: '100.00',
        puntajePlazo: '100.00',
        puntajeConfiabilidad: '60.00',
        puntaje: '94.00',
      });
      expect(uno.body.recomendado.nombre).toBe('Norte');
      expect(uno.body).toMatchObject({ comparable: false, cambiaProveedor: false });

      const ninguno = await comparacion(prod['BI-09']!).expect(200);
      expect(ninguno.body).toMatchObject({
        proveedores: [],
        recomendado: null,
        masBarato: null,
        principal: null,
        comparable: false,
        cambiaProveedor: false,
        ahorroEstimado: null,
      });
    }, 120_000);

    it('CP-12.2b entrega en el día y empates', async () => {
      const ab = await comparacion(prod['P-AB']!, duenioB).expect(200);
      expect(de(ab.body.proveedores, 'Prov A').puntaje).toBe('88.00');
      expect(de(ab.body.proveedores, 'Prov B').puntaje).toBe('75.25');
      expect(ab.body.recomendado.nombre).toBe('Prov A');
      expect(ab.body.masBarato.nombre).toBe('Prov B');

      const cd = await comparacion(prod['P-CD']!, duenioB).expect(200);
      expect(nombres(cd.body.proveedores)).toEqual(['Prov C', 'Prov D']);
      expect(de(cd.body.proveedores, 'Prov C').puntaje).toBe(
        de(cd.body.proveedores, 'Prov D').puntaje,
      );
      expect(cd.body.recomendado.nombre).toBe('Prov C');
    }, 120_000);

    it('un producto que no existe o un id mal formado', async () => {
      const r = await comparacion(randomUUID()).expect(404);
      expect(r.body.code).toBe('NO_ENCONTRADO');
      await comparacion('no-es-un-uuid').expect(400);
    }, 120_000);
  });

  describe('resumen', () => {
    it('CP-12.3 resumen, totales y oportunidades', async () => {
      const todo = await resumen().expect(200);
      expect(codigos(todo.body.items)).toEqual(['FA-220', 'AC-5L']);
      expect(insumo(todo.body.items, 'FA-220')).toMatchObject({
        proveedores: 3,
        recomendado: { nombre: 'Este', costoNeto: '2100.00', puntaje: '97.14' },
        masBarato: { nombre: 'Sur' },
        principal: { nombre: 'Norte', costoNeto: '2340.00' },
        cambiaProveedor: true,
        unidades30d: 60,
        ahorroEstimado: '14400.00',
      });
      expect(insumo(todo.body.items, 'AC-5L')).toMatchObject({
        proveedores: 2,
        recomendado: { nombre: 'Este' },
        principal: { nombre: 'Este' },
        cambiaProveedor: false,
        ahorroEstimado: null,
      });
      expect(todo.body.totales).toEqual({
        comparables: 2,
        conCambio: 1,
        ahorroEstimado: '14400.00',
      });
      expect(todo.body.siguienteCursor).toBeNull();

      const oportunidades = await resumen('?soloOportunidades=true').expect(200);
      expect(codigos(oportunidades.body.items)).toEqual(['FA-220']);
      // Los totales no dependen del filtro.
      expect(oportunidades.body.totales).toEqual(todo.body.totales);
    }, 120_000);

    it('CP-12.3b sin proveedor principal o sin ventas', async () => {
      const r = await resumen('', duenioB).expect(200);
      expect(insumo(r.body.items, 'SP-1')).toMatchObject({
        principal: null,
        cambiaProveedor: true,
        ahorroEstimado: null,
      });
      expect(insumo(r.body.items, 'SV-1')).toMatchObject({
        recomendado: { nombre: 'Prov B' },
        principal: { nombre: 'Prov A' },
        cambiaProveedor: true,
        unidades30d: 0,
        ahorroEstimado: null,
      });
      // P-AB ya tiene de principal a su recomendado.
      expect(r.body.totales).toEqual({ comparables: 4, conCambio: 3, ahorroEstimado: '0.00' });
    }, 120_000);

    it('búsqueda y paginación: la segunda página continúa donde terminó la primera', async () => {
      const primera = await resumen('?limit=3', duenioB).expect(200);
      // Sin ahorro estimado, primero los que conviene cambiar y después por nombre.
      expect(codigos(primera.body.items)).toEqual(['P-CD', 'SP-1', 'SV-1']);
      expect(primera.body.siguienteCursor).not.toBeNull();
      const segunda = await resumen(
        `?limit=3&cursor=${encodeURIComponent(primera.body.siguienteCursor)}`,
        duenioB,
      ).expect(200);
      expect(codigos(segunda.body.items)).toEqual(['P-AB']);
      expect(segunda.body.siguienteCursor).toBeNull();

      const porCodigo = await resumen('?q=sv-', duenioB).expect(200);
      expect(codigos(porCodigo.body.items)).toEqual(['SV-1']);
      const porNombre = await resumen('?q=insumo%20p-', duenioB).expect(200);
      expect(codigos(porNombre.body.items)).toEqual(['P-CD', 'P-AB']);
      expect(porNombre.body.totales.comparables).toBe(4);
    }, 120_000);

    it('parámetros inválidos responden 400', async () => {
      const filtro = await resumen('?soloOportunidades=si').expect(400);
      expect(filtro.body.code).toBe('VALIDACION');
      expect(filtro.body.details).toHaveProperty('soloOportunidades');
      const cursor = await resumen('?cursor=xx').expect(400);
      expect(cursor.body.details).toHaveProperty('cursor');
      await resumen('?limit=0').expect(400);
    }, 120_000);
  });

  describe('plan, permisos y aislamiento', () => {
    it('CP-12.5 los planes FREE y PRO reciben 402', async () => {
      for (const quien of [duenioFree, duenioPro]) {
        const lista = await resumen('', quien).expect(402);
        expect(lista.body).toMatchObject({
          code: 'PLAN_REQUERIDO',
          details: { planMinimo: 'PREMIUM' },
        });
        const detalle = await comparacion(prod['FA-220']!, quien).expect(402);
        expect(detalle.body.details.planMinimo).toBe('PREMIUM');
      }
    }, 120_000);

    it('CP-12.5b el contador y la empleada reciben 403', async () => {
      for (const quien of [contador, empleada]) {
        expect((await resumen('', quien).expect(403)).body.code).toBe('SIN_PERMISO');
        expect((await comparacion(prod['FA-220']!, quien).expect(403)).body.code).toBe(
          'SIN_PERMISO',
        );
      }
      await t.http().get('/api/v1/supplier-comparison').expect(401);
    }, 120_000);

    it('CP-12.5c un comercio no ve los insumos de otro', async () => {
      const deB = await resumen('', duenioB).expect(200);
      expect(codigos(deB.body.items).sort()).toEqual(['P-AB', 'P-CD', 'SP-1', 'SV-1']);
      const ajena = await comparacion(prod['FA-220']!, duenioB).expect(404);
      expect(ajena.body.code).toBe('NO_ENCONTRADO');
    }, 120_000);
  });

  describe('siempre al día', () => {
    it('CP-12.4b dar de baja a un proveedor lo saca de la comparación', async () => {
      await t.http().delete(`/api/v1/suppliers/${prov['Este']}`).set(auth(duenioA)).expect(200);
      const r = await comparacion(prod['FA-220']!).expect(200);
      expect(nombres(r.body.proveedores)).toEqual(['Sur', 'Norte']);
      expect(de(r.body.proveedores, 'Sur')).toMatchObject({
        puntajePlazo: '75.00',
        puntaje: '90.75',
      });
      expect(de(r.body.proveedores, 'Norte')).toMatchObject({
        puntajePlazo: '100.00',
        puntaje: '85.28',
      });
      expect(r.body.recomendado.nombre).toBe('Sur');
      // AC-5L se queda con un solo proveedor: ya no es comparable.
      expect(codigos((await resumen().expect(200)).body.items)).toEqual(['FA-220']);

      await editarProveedor(prov['Este']!, { activo: true });
      expect((await comparacion(prod['FA-220']!).expect(200)).body.recomendado.nombre).toBe('Este');
    }, 120_000);

    it('cambiar el plazo o la confiabilidad se refleja en la consulta siguiente', async () => {
      await editarProveedor(prov['Sur']!, { leadTimeDias: 2, confiabilidad: 5 });
      const r = await comparacion(prod['FA-220']!).expect(200);
      // Sur iguala a Este en plazo y confiabilidad y es más barato: 60 + 25 + 15.
      expect(de(r.body.proveedores, 'Sur').puntaje).toBe('100.00');
      expect(r.body.recomendado.nombre).toBe('Sur');
      await editarProveedor(prov['Sur']!, { leadTimeDias: 7, confiabilidad: 4 });
    }, 120_000);

    it('CP-12.4 una lista importada cambia los puntajes y el más barato', async () => {
      const res = await t
        .http()
        .post(`/api/v1/suppliers/${prov['Norte']}/price-list`)
        .set(auth(duenioA))
        .send({ items: [{ productoId: prod['FA-220'], costoNeto: '1700.00' }] })
        .expect(201);
      expect(res.body.insertados).toBe(1);

      const r = await comparacion(prod['FA-220']!).expect(200);
      expect(nombres(r.body.proveedores)).toEqual(['Este', 'Norte', 'Sur']);
      expect(de(r.body.proveedores, 'Norte')).toMatchObject({
        costoNeto: '1700.00',
        diferenciaPct: '0.00',
        puntaje: '81.50',
      });
      expect(de(r.body.proveedores, 'Este').puntaje).toBe('88.57');
      expect(de(r.body.proveedores, 'Sur').puntaje).toBe('72.38');
      expect(r.body.recomendado.nombre).toBe('Este');
      expect(r.body.masBarato.nombre).toBe('Norte');
    }, 120_000);

    it('CP-12.6 usar al recomendado como principal lo saca de las oportunidades', async () => {
      const antes = await resumen('?soloOportunidades=true').expect(200);
      expect(codigos(antes.body.items)).toEqual(['FA-220']);

      const editado = await t
        .http()
        .patch(`/api/v1/products/${prod['FA-220']}`)
        .set(auth(duenioA))
        .send({ proveedorPrincipalId: prov['Este'] })
        .expect(200);
      expect(editado.body.costoReposicion).toBe('2100.00');
      expect(editado.body.proveedorPrincipal.id).toBe(prov['Este']);

      const despues = await resumen('?soloOportunidades=true').expect(200);
      expect(despues.body.items).toEqual([]);
      expect(despues.body.totales).toEqual({
        comparables: 2,
        conCambio: 0,
        ahorroEstimado: '0.00',
      });
      const detalle = await comparacion(prod['FA-220']!).expect(200);
      expect(detalle.body.principal.nombre).toBe('Este');
      expect(detalle.body.cambiaProveedor).toBe(false);
    }, 120_000);
  });

  it('carga: 5.000 productos con 3 proveedores cada uno responden en menos de 3 segundos', async () => {
    await conCargaExclusiva(async () => {
      const proveedores = [
        { nombre: 'Carga Uno', leadTimeDias: 5, confiabilidad: 3 },
        { nombre: 'Carga Dos', leadTimeDias: 7, confiabilidad: 4 },
        { nombre: 'Carga Tres', leadTimeDias: 2, confiabilidad: 5 },
      ].map((p) => ({
        id: randomUUID(),
        comercioId: comercio['c']!,
        nombreNormalizado: p.nombre.toUpperCase(),
        ...p,
      }));
      const productos = Array.from({ length: 5000 }, (_, i) => ({
        id: randomUUID(),
        comercioId: comercio['c']!,
        codigo: `CMP-${i}`,
        codigoNormalizado: `CMP-${i}`,
        nombre: `Insumo de carga ${String(i).padStart(4, '0')}`,
        precioVenta: 4000,
        alicuotaIva: 21,
        costoReposicion: 2340,
        stockActual: 10,
        stockSeguridad: 1,
        proveedorPrincipalId: proveedores[0]!.id,
      }));
      const costos = [2340, 2000, 2100];
      const precios = productos.flatMap((p) =>
        proveedores.map((pr, j) => ({
          comercioId: comercio['c']!,
          productoId: p.id,
          proveedorId: pr.id,
          costoNeto: costos[j]!,
          origen: 'IMPORT' as const,
          usuarioId: usuario['c']!,
        })),
      );
      await t.prisma.comoSistema(async (tx) => {
        await tx.proveedor.createMany({ data: proveedores });
        await tx.producto.createMany({ data: productos });
        await tx.precioProveedor.createMany({ data: precios });
      });

      const inicio = Date.now();
      const r = await resumen('?limit=25', duenioC).expect(200);
      const ms = Date.now() - inicio;
      expect(r.body.totales).toEqual({
        comparables: 5000,
        conCambio: 5000,
        ahorroEstimado: '0.00',
      });
      expect(r.body.items).toHaveLength(25);
      expect(r.body.items[0].recomendado.nombre).toBe('Carga Tres');
      expect(r.body.siguienteCursor).not.toBeNull();
      expect(ms).toBeLessThan(3000);

      const detalle = await comparacion(productos[0]!.id, duenioC).expect(200);
      expect(detalle.body.proveedores).toHaveLength(3);
    });
  }, 600_000);
});
