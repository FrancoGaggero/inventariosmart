import { describe, expect, it } from 'vitest';
import {
  AVISO_PLAN,
  PREGUNTAS_SUGERIDAS,
  avisoDeError,
  bloquesDeTexto,
  contadorDeCaracteres,
  excedeElLargo,
  fechaDeConversacion,
  fraseFuentes,
  puedeEnviar,
} from './asistente-formato';

describe('campo de la consulta', () => {
  it('cuenta los caracteres contra el máximo', () => {
    expect(contadorDeCaracteres('')).toBe('0 / 1.000');
    expect(contadorDeCaracteres('a'.repeat(1000))).toBe('1.000 / 1.000');
  });

  it('se puede enviar si hay texto, no supera el máximo y no hay otra consulta en curso', () => {
    expect(puedeEnviar('¿Qué tengo que reponer?', false)).toBe(true);
    expect(puedeEnviar('   ', false)).toBe(false);
    expect(puedeEnviar('hola', true)).toBe(false);
    expect(puedeEnviar('a'.repeat(1001), false)).toBe(false);
    expect(excedeElLargo(`  ${'a'.repeat(1000)}  `)).toBe(false);
    expect(excedeElLargo('a'.repeat(1001))).toBe(true);
  });

  it('ofrece cuatro preguntas para empezar', () => {
    expect(PREGUNTAS_SUGERIDAS).toHaveLength(5);
    expect(PREGUNTAS_SUGERIDAS).toContain('¿Qué fue lo que más vendí este mes?');
    expect(PREGUNTAS_SUGERIDAS).toContain('¿Qué productos tengo que reponer?');
  });
});

describe('fuentes de una respuesta', () => {
  it('las nombra en una frase, sin repetir', () => {
    expect(fraseFuentes([])).toBe('');
    expect(fraseFuentes([{ nombre: 'Productos' }])).toBe('Consulté: Productos.');
    expect(
      fraseFuentes([
        { nombre: 'Proveedores' },
        { nombre: 'Productos' },
        { nombre: 'Productos' },
        { nombre: 'Orden en borrador' },
      ]),
    ).toBe('Consulté: Proveedores, Productos y Orden en borrador.');
  });
});

describe('texto de la respuesta', () => {
  it('separa párrafos y listas', () => {
    expect(
      bloquesDeTexto(
        'Tenés 2 productos para reponer:\n\n- Filtro FA-220: quedan 3\n- Aceite 5W-30: sin stock\n\nTe conviene pedirlos hoy.',
      ),
    ).toEqual([
      { tipo: 'parrafo', texto: 'Tenés 2 productos para reponer:' },
      { tipo: 'lista', items: ['Filtro FA-220: quedan 3', 'Aceite 5W-30: sin stock'] },
      { tipo: 'parrafo', texto: 'Te conviene pedirlos hoy.' },
    ]);
  });

  it('quita las marcas de formato y acepta listas numeradas', () => {
    expect(bloquesDeTexto('## Resumen\n**FA-220** fue el mejor.\n1. Uno\n2) Dos')).toEqual([
      { tipo: 'parrafo', texto: 'Resumen' },
      { tipo: 'parrafo', texto: 'FA-220 fue el mejor.' },
      { tipo: 'lista', items: ['Uno', 'Dos'] },
    ]);
    expect(bloquesDeTexto('  \n ')).toEqual([]);
  });

  it('el código HTML queda como texto', () => {
    expect(bloquesDeTexto('<img src=x onerror=alert(1)>')).toEqual([
      { tipo: 'parrafo', texto: '<img src=x onerror=alert(1)>' },
    ]);
  });
});

describe('fecha de una conversación', () => {
  const ahora = new Date(2026, 9, 2, 15, 0);

  it('hoy con la hora, ayer, y antes con el día', () => {
    expect(fechaDeConversacion(new Date(2026, 9, 2, 9, 5).toISOString(), ahora)).toMatch(
      /^hoy 09:05$/,
    );
    expect(fechaDeConversacion(new Date(2026, 9, 1, 23, 59).toISOString(), ahora)).toBe('ayer');
    expect(fechaDeConversacion(new Date(2026, 9, 2, 14, 32).toISOString(), ahora)).toBe(
      'hoy 14:32',
    );
    expect(fechaDeConversacion(new Date(2026, 8, 12, 10, 0).toISOString(), ahora)).toMatch(
      /^12 (de )?sept?/,
    );
  });
});

describe('avisos al enviar', () => {
  it('distingue el plan, el límite diario y la falta del servicio de un error', () => {
    expect(avisoDeError(402, 'Esta función está disponible a partir del plan PREMIUM.')).toEqual({
      tono: 'plan',
      texto: AVISO_PLAN,
    });
    expect(
      avisoDeError(
        429,
        'Llegaste al límite de 50 consultas por día al asistente. Se renueva mañana.',
      ),
    ).toEqual({
      tono: 'warn',
      texto: 'Llegaste al límite de 50 consultas por día al asistente. Se renueva mañana.',
    });
    expect(avisoDeError(503, 'x').tono).toBe('warn');
    expect(avisoDeError(503, 'x').texto).toMatch(/Tu consulta quedó escrita/);
    expect(avisoDeError(404, 'No encontramos esa conversación.')).toEqual({
      tono: 'error',
      texto: 'No encontramos esa conversación.',
    });
  });
});
