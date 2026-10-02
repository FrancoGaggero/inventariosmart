import { describe, expect, it } from 'vitest';
import {
  ASISTENTE_MAX_CARACTERES,
  HERRAMIENTAS_ASISTENTE,
  MensajeCreateSchema,
  NOMBRES_HERRAMIENTA,
  fechaBuenosAires,
  inicioDelDiaBuenosAires,
  rankingDeVentas,
  tituloDeConversacion,
  type VentasDeProducto,
} from './asistente';

describe('productos más vendidos', () => {
  const fila = (
    codigo: string,
    unidades: number,
    importeConIva: number,
    extra: Partial<VentasDeProducto> = {},
  ): VentasDeProducto => ({
    id: codigo,
    codigo,
    nombre: `Producto ${codigo}`,
    activo: true,
    unidades,
    importeConIva,
    alicuotaIva: 21,
    ...extra,
  });
  // AC-5L vende más unidades; FA-220 factura más.
  const filas = [
    fila('FA-220', 40, 484_000),
    fila('AC-5L', 120, 290_400),
    fila('BA-120', 5, 60_500, { activo: false }),
  ];

  it('por unidades: ordena, calcula la participación y marca los dados de baja', () => {
    const r = rankingDeVentas(filas, 'UNIDADES');
    expect(r).toMatchObject({
      criterio: 'UNIDADES',
      totalUnidades: 165,
      totalFacturacionNeta: '690000.00',
    });
    expect(r.productos.map((p) => p.codigo)).toEqual(['AC-5L', 'FA-220', 'BA-120']);
    expect(r.productos[0]).toMatchObject({
      unidadesVendidas: 120,
      facturacionNeta: '240000.00',
      participacionUnidadesPct: 72.7,
      participacionFacturacionPct: 34.8,
      dadoDeBaja: false,
    });
    expect(r.productos[2]!.dadoDeBaja).toBe(true);
  });

  it('por facturación: neto de IVA con la alícuota de cada producto (RN-03)', () => {
    const exento = fila('EX-0', 10, 100_000, { alicuotaIva: 0 });
    const r = rankingDeVentas([...filas, exento], 'FACTURACION');
    expect(r.productos.map((p) => p.codigo)).toEqual(['FA-220', 'AC-5L', 'EX-0', 'BA-120']);
    expect(r.productos[0]).toMatchObject({
      facturacionNeta: '400000.00',
      participacionFacturacionPct: 50.6,
      participacionUnidadesPct: 22.9,
    });
    expect(r.productos[2]!.facturacionNeta).toBe('100000.00');
    expect(r.totalFacturacionNeta).toBe('790000.00');
  });

  it('desempata por el otro criterio y después por nombre', () => {
    const empate = [fila('B', 10, 1210), fila('A', 10, 1210), fila('C', 10, 2420)];
    expect(rankingDeVentas(empate, 'UNIDADES').productos.map((p) => p.codigo)).toEqual([
      'C',
      'A',
      'B',
    ]);
    const mismoMonto = [fila('X', 1, 1210), fila('Y', 3, 1210)];
    expect(rankingDeVentas(mismoMonto, 'FACTURACION').productos.map((p) => p.codigo)).toEqual([
      'Y',
      'X',
    ]);
  });

  it('redondea la facturación neta a dos decimales', () => {
    const r = rankingDeVentas([fila('R', 1, 100)], 'FACTURACION');
    expect(r.productos[0]).toMatchObject({
      facturacionNeta: '82.64',
      participacionUnidadesPct: 100,
      participacionFacturacionPct: 100,
    });
  });

  it('los totales y la participación cuentan todas las filas, aunque se recorte a 10', () => {
    const muchas = Array.from({ length: 15 }, (_, i) => fila(`P-${i}`, i + 1, (i + 1) * 121));
    const r = rankingDeVentas(muchas, 'UNIDADES', 50);
    expect(r.productos).toHaveLength(10);
    expect(r.totalUnidades).toBe(120);
    expect(r.productos[0]).toMatchObject({
      codigo: 'P-14',
      participacionUnidadesPct: 12.5,
      participacionFacturacionPct: 12.5,
    });
    expect(rankingDeVentas(muchas, 'UNIDADES', 3).productos).toHaveLength(3);
    const diez = rankingDeVentas(muchas.slice(0, 10), 'UNIDADES').productos;
    for (const campo of ['participacionUnidadesPct', 'participacionFacturacionPct'] as const) {
      const suma = diez.reduce((t, p) => t + p[campo], 0);
      expect(Math.abs(suma - 100)).toBeLessThanOrEqual(0.5);
    }
  });

  it('sin ventas devuelve la lista vacía y los totales en cero', () => {
    expect(rankingDeVentas([fila('Z', 0, 0)], 'UNIDADES')).toEqual({
      criterio: 'UNIDADES',
      totalUnidades: 0,
      totalFacturacionNeta: '0.00',
      productos: [],
    });
  });
});

describe('mensaje al asistente (CP-08.1b)', () => {
  it('acepta hasta 1.000 caracteres y recorta los espacios', () => {
    expect(MensajeCreateSchema.parse({ mensaje: '  ¿Qué tengo que reponer?  ' })).toEqual({
      mensaje: '¿Qué tengo que reponer?',
    });
    expect(
      MensajeCreateSchema.safeParse({ mensaje: 'a'.repeat(ASISTENTE_MAX_CARACTERES) }).success,
    ).toBe(true);
  });

  it('rechaza el mensaje vacío, el que sólo tiene espacios y el de 1.001 caracteres', () => {
    for (const mensaje of ['', '   ', 'a'.repeat(ASISTENTE_MAX_CARACTERES + 1)]) {
      const r = MensajeCreateSchema.safeParse({ mensaje });
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0]?.path).toEqual(['mensaje']);
    }
    expect(MensajeCreateSchema.safeParse({}).success).toBe(false);
  });

  it('la conversación, si viene, es un identificador válido', () => {
    expect(MensajeCreateSchema.safeParse({ mensaje: 'hola', conversacionId: 'x' }).success).toBe(
      false,
    );
    expect(
      MensajeCreateSchema.safeParse({
        mensaje: 'hola',
        conversacionId: '3f0e2a54-6a59-4a0e-9d0f-0d1a5f1f3c11',
      }).success,
    ).toBe(true);
  });
});

describe('herramientas del asistente', () => {
  it('son trece, cada una con su nombre legible', () => {
    expect(NOMBRES_HERRAMIENTA).toHaveLength(13);
    expect(HERRAMIENTAS_ASISTENTE.perdidas_por_falta_de_stock).toBe('Pérdidas por falta de stock');
    expect(HERRAMIENTAS_ASISTENTE.stock_parado).toBe('Stock parado');
    expect(HERRAMIENTAS_ASISTENTE.productos_mas_vendidos).toBe('Productos más vendidos');
    expect(HERRAMIENTAS_ASISTENTE.productos_mas_rentables).toBe('Productos más rentables');
    expect(HERRAMIENTAS_ASISTENTE.preparar_orden).toBe('Orden en borrador');
  });
});

describe('título de la conversación', () => {
  it('usa el primer mensaje en una línea', () => {
    expect(tituloDeConversacion('  ¿Cuál fue el producto\nmás rentable?  ')).toBe(
      '¿Cuál fue el producto más rentable?',
    );
  });

  it('corta a 80 caracteres con puntos suspensivos', () => {
    const titulo = tituloDeConversacion('palabra '.repeat(30));
    expect(titulo.length).toBeLessThanOrEqual(80);
    expect(titulo.endsWith('…')).toBe(true);
  });
});

describe('día calendario de Buenos Aires (límite diario)', () => {
  it('empieza a las 03:00 UTC', () => {
    expect(inicioDelDiaBuenosAires(new Date('2026-10-02T15:30:00.000Z')).toISOString()).toBe(
      '2026-10-02T03:00:00.000Z',
    );
    expect(inicioDelDiaBuenosAires(new Date('2026-10-02T03:00:00.000Z')).toISOString()).toBe(
      '2026-10-02T03:00:00.000Z',
    );
  });

  it('antes de las 03:00 UTC todavía es el día anterior', () => {
    const noche = new Date('2026-10-02T02:59:59.000Z');
    expect(inicioDelDiaBuenosAires(noche).toISOString()).toBe('2026-10-01T03:00:00.000Z');
    expect(fechaBuenosAires(noche)).toBe('2026-10-01');
    expect(fechaBuenosAires(new Date('2026-10-02T03:00:00.000Z'))).toBe('2026-10-02');
  });
});
