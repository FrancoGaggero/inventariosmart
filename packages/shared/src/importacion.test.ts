import { describe, expect, it } from 'vitest';
import {
  COLUMNAS_IMPORTACION,
  ImportacionProductosConfirmSchema,
  contarFilas,
  filasAplicablesProductos,
  type FilaImportacion,
} from './importacion';

const datos = {
  codigo: 'FA-220',
  nombre: 'Filtro',
  precioVenta: '3990.00',
  costoReposicion: '2400.00',
  stockInicial: 10,
  stockSeguridad: 5,
  diasAnticipacionAlerta: 3,
  alicuotaIva: 21,
};

describe('HU-05 (importación de productos)', () => {
  it('las columnas obligatorias son código, nombre y precio', () => {
    const obligatorias = Object.entries(COLUMNAS_IMPORTACION)
      .filter(([, c]) => c.obligatoria)
      .map(([k]) => k);
    expect(obligatorias).toEqual(['codigo', 'nombre', 'precioVenta']);
  });

  it('filasAplicablesProductos y contarFilas', () => {
    const filas: FilaImportacion[] = [
      {
        fila: 1,
        codigo: 'FA-220',
        estado: 'ACTUALIZA',
        datos,
        productoId: '3f1c2a9e-5b6d-4c7e-8f90-1a2b3c4d5e61',
        stockActual: 4,
        error: null,
      },
      {
        fila: 2,
        codigo: 'AM-1L',
        estado: 'NUEVO',
        datos: { ...datos, codigo: 'AM-1L' },
        productoId: null,
        stockActual: null,
        error: null,
      },
      {
        fila: 3,
        codigo: '',
        estado: 'INVALIDA',
        datos: null,
        productoId: null,
        stockActual: null,
        error: 'codigo: El código es obligatorio.',
      },
    ];
    expect(contarFilas(filas)).toEqual({ total: 3, nuevos: 1, actualizan: 1, invalidas: 1 });
    expect(filasAplicablesProductos(filas).map((f) => [f.fila, f.estado])).toEqual([
      [1, 'ACTUALIZA'],
      [2, 'NUEVO'],
    ]);
  });

  it('la confirmación sólo admite NUEVO/ACTUALIZA sin códigos repetidos', () => {
    const ok = ImportacionProductosConfirmSchema.safeParse({
      filas: [{ fila: 1, codigo: 'FA-220', estado: 'NUEVO', datos }],
    });
    expect(ok.success).toBe(true);
    const repetido = ImportacionProductosConfirmSchema.safeParse({
      filas: [
        { fila: 1, codigo: 'FA-220', estado: 'NUEVO', datos },
        { fila: 2, codigo: 'fa-220', estado: 'NUEVO', datos: { ...datos, codigo: 'fa-220' } },
      ],
    });
    expect(repetido.success).toBe(false);
    const invalida = ImportacionProductosConfirmSchema.safeParse({
      filas: [{ fila: 1, codigo: 'X', estado: 'INVALIDA', datos }],
    });
    expect(invalida.success).toBe(false);
    expect(ImportacionProductosConfirmSchema.safeParse({ filas: [] }).success).toBe(false);
  });
});
