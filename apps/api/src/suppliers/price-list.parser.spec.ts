import { parsearMonto, parsearPlanilla } from './price-list.parser';

const csv = (texto: string, nombre = 'lista.csv') =>
  parsearPlanilla(Buffer.from(texto, 'utf8'), nombre);

describe('price-list.parser (unitario)', () => {
  it('parsearMonto entiende coma decimal, punto de miles y símbolos (CP-02.4g)', () => {
    expect(parsearMonto('2.340,50')).toBe('2340.50');
    expect(parsearMonto('2340,5')).toBe('2340.50');
    expect(parsearMonto('2,340.50')).toBe('2340.50');
    expect(parsearMonto('2.340')).toBe('2340.00');
    expect(parsearMonto('2.5')).toBe('2.50');
    expect(parsearMonto('$ 1.200')).toBe('1200.00');
    expect(parsearMonto('880')).toBe('880.00');
    expect(parsearMonto('abc')).toBeNull();
    expect(parsearMonto('-5')).toBeNull();
    expect(parsearMonto('')).toBeNull();
  });

  it('CSV con encabezados reconocibles y separador punto y coma', async () => {
    const filas = await csv('Código;Costo\nFA-220;2.340,50\nAM-1L;880\n');
    expect(filas).toEqual([
      { fila: 1, codigo: 'FA-220', costoTexto: '2.340,50' },
      { fila: 2, codigo: 'AM-1L', costoTexto: '880' },
    ]);
  });

  it('CSV con columnas en otro orden, comas y comillas', async () => {
    const filas = await csv('﻿"precio neto","descripcion","sku"\n"1,50","Filtro, aire","FA-220"\n');
    expect(filas).toEqual([{ fila: 1, codigo: 'FA-220', costoTexto: '1,50' }]);
  });

  it('sin encabezados reconocibles usa las dos primeras columnas; la primera fila es dato si es numérica', async () => {
    const conDatos = await csv('FA-220;2100\nAM-1L;880\n');
    expect(conDatos.map((f) => f.codigo)).toEqual(['FA-220', 'AM-1L']);
    const conTitulo = await csv('Producto;Valor\nFA-220;2100\n');
    expect(conTitulo).toEqual([{ fila: 1, codigo: 'FA-220', costoTexto: '2100' }]);
  });

  it('rechaza formatos no admitidos, planillas vacías y de una sola columna', async () => {
    await expect(csv('x', 'lista.pdf')).rejects.toThrow(/xlsx o \.csv/);
    await expect(csv('\n\n')).rejects.toThrow(/vacía/);
    await expect(csv('FA-220\nAM-1L\n')).rejects.toThrow(/columnas/);
  });

  it('rechaza más de 5.000 filas de datos', async () => {
    const lineas = ['codigo;costo', ...Array.from({ length: 5001 }, (_, i) => `P-${i};10`)];
    await expect(csv(lineas.join('\n'))).rejects.toThrow(/5000/);
  });

  it('lee un .xlsx generado con exceljs, incluidas celdas numéricas y fórmulas', async () => {
    const ExcelJS = await import('exceljs');
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Lista');
    ws.addRow(['Código', 'Costo neto']);
    ws.addRow(['FA-220', 2340.5]);
    ws.addRow(['AM-1L', { formula: '800+80', result: 880 }]);
    ws.addRow(['BI-09', '1.200']);
    const buffer = Buffer.from(await wb.xlsx.writeBuffer());
    const filas = await parsearPlanilla(buffer, 'lista.xlsx');
    expect(filas).toEqual([
      { fila: 1, codigo: 'FA-220', costoTexto: '2340.5' },
      { fila: 2, codigo: 'AM-1L', costoTexto: '880' },
      { fila: 3, codigo: 'BI-09', costoTexto: '1.200' },
    ]);
  });
});
