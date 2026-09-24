import { armarOrden, formatearMonto, htmlDeOrden } from './orden';

describe('plantilla de la orden de compra (HU-07 criterio 2)', () => {
  const orden = {
    numero: 'OC-0001',
    comercio: { nombre: 'Repuestos Carlos' },
    proveedor: { nombre: 'Sur', contacto: 'Marta', leadTimeDias: 7 },
    items: [
      { codigo: 'FA-220', nombre: 'Filtro <Aire>', cantidad: 70, costoUnitarioNeto: '2000.00' },
      { codigo: 'AM-1L', nombre: 'Aceite 1L', cantidad: 1, costoUnitarioNeto: null },
    ],
    totalNeto: '140000.00',
    duenio: { nombre: 'Carlos Pérez', email: 'carlos@repuestos.test' },
  };

  it('asunto, saludo con contacto, ítems con código, cantidad y costo, total, plazo y firma', () => {
    const t = armarOrden(orden);
    expect(t.asunto).toBe('Orden de compra OC-0001 · Repuestos Carlos');
    expect(t.texto).toContain('Hola Marta (Sur):');
    expect(t.texto).toContain(
      '- FA-220 · Filtro <Aire>: 70 unidades a $ 2.000,00 c/u (neto) = $ 140.000,00',
    );
    expect(t.texto).toContain('- AM-1L · Aceite 1L: 1 unidad, precio a confirmar');
    expect(t.texto).toContain('Total neto estimado (sin IVA): $ 140.000,00');
    expect(t.texto).toContain('Plazo de entrega esperado: 7 días');
    expect(t.texto).toContain('Carlos Pérez · Repuestos Carlos');
    expect(t.texto).toContain('carlos@repuestos.test');
  });

  it('sin contacto saluda al equipo; sin costos el total queda a confirmar; el HTML escapa', () => {
    const t = armarOrden({
      ...orden,
      proveedor: { nombre: 'Norte', contacto: null, leadTimeDias: 1 },
      items: [orden.items[1]!],
      totalNeto: '0.00',
      duenio: { nombre: null, email: 'x@y.test' },
    });
    expect(t.texto).toContain('Hola, equipo de Norte:');
    expect(t.texto).toContain('Total a confirmar según su lista vigente.');
    expect(t.texto).toContain('Plazo de entrega esperado: 1 día');
    expect(t.texto).toContain('\nRepuestos Carlos\nx@y.test');
    expect(htmlDeOrden('a <b> & "c"')).toContain('a &lt;b&gt; &amp; &quot;c&quot;');
    expect(formatearMonto('1234567.5')).toBe('$ 1.234.567,50');
  });
});
