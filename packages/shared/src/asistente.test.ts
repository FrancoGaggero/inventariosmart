import { describe, expect, it } from 'vitest';
import {
  ASISTENTE_MAX_CARACTERES,
  HERRAMIENTAS_ASISTENTE,
  MensajeCreateSchema,
  NOMBRES_HERRAMIENTA,
  fechaBuenosAires,
  inicioDelDiaBuenosAires,
  tituloDeConversacion,
} from './asistente';

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
  it('son diez, cada una con su nombre legible', () => {
    expect(NOMBRES_HERRAMIENTA).toHaveLength(10);
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
