import { describe, expect, it } from 'vitest';
import { fechaLarga, saludo } from './inicio-formato';

// Buenos Aires es UTC−03:00 todo el año.
const ba = (fecha: string, hhmm: string) => new Date(`${fecha}T${hhmm}:00-03:00`);

describe('inicio (web-redesign D5)', () => {
  it('saluda según la hora de Buenos Aires, en sus límites', () => {
    expect(saludo(ba('2026-10-02', '04:59'))).toBe('Buenas noches');
    expect(saludo(ba('2026-10-02', '05:00'))).toBe('Buen día');
    expect(saludo(ba('2026-10-02', '11:59'))).toBe('Buen día');
    expect(saludo(ba('2026-10-02', '12:00'))).toBe('Buenas tardes');
    expect(saludo(ba('2026-10-02', '19:59'))).toBe('Buenas tardes');
    expect(saludo(ba('2026-10-02', '20:00'))).toBe('Buenas noches');
  });

  it('usa la hora y el día de Buenos Aires aunque en UTC ya sea mañana', () => {
    // 22:30 en Buenos Aires son las 01:30 UTC del día siguiente.
    const noche = new Date('2026-10-03T01:30:00Z');
    expect(saludo(noche)).toBe('Buenas noches');
    expect(fechaLarga(noche)).toBe('viernes 2 de octubre');
    expect(fechaLarga(ba('2026-10-03', '09:00'))).toBe('sábado 3 de octubre');
  });
});
