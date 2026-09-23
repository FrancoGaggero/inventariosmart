import { armarResumen } from './resumen';

describe('plantilla del resumen de alertas (HU-06 criterio 3)', () => {
  const alertas = [
    {
      codigo: 'FA-220',
      nombre: 'Filtro <Aire>',
      stock: 18,
      diasCobertura: 9,
      cantidadSugerida: 56,
      severidad: 'PROXIMA' as const,
    },
    {
      codigo: 'BT-12',
      nombre: 'Batería 12V',
      stock: 1,
      diasCobertura: 0,
      cantidadSugerida: 12,
      severidad: 'CRITICA' as const,
    },
  ];

  it('asunto, filas y enlace a la web', () => {
    const c = armarResumen('Repuestos Carlos', alertas, 'https://inventariosmart0.vercel.app/');
    expect(c.asunto).toBe('InventarioSmart · 2 productos para reponer en Repuestos Carlos');
    expect(c.html).toContain('FA-220 · Filtro &lt;Aire&gt;');
    expect(c.html).toContain('>18<');
    expect(c.html).toContain('9 días');
    expect(c.html).toContain('>56<');
    expect(c.html).toContain('se agota hoy');
    expect(c.html).toContain('Crítica');
    expect(c.html).toContain('href="https://inventariosmart0.vercel.app/alertas"');
    expect(c.texto).toContain(
      '- FA-220 · Filtro <Aire>: stock 18, cobertura 9 días, sugerido 56 (Próxima al quiebre)',
    );
    expect(c.texto).toContain('Ver alertas: https://inventariosmart0.vercel.app/alertas');
  });

  it('singular con una sola alerta y cobertura desconocida', () => {
    const c = armarResumen('Kiosco', [{ ...alertas[0]!, diasCobertura: null }], 'https://x.test');
    expect(c.asunto).toBe('InventarioSmart · 1 producto para reponer en Kiosco');
    expect(c.texto).toContain('cobertura sin ventas recientes');
  });
});
