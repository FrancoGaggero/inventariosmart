/**
 * Hora de referencia de los cálculos que dependen del momento de la consulta (quiebres en curso,
 * días sin vender). Inyectable para que los e2e la fijen.
 */
export const RELOJ = Symbol('RELOJ');
export type Reloj = () => Date;
export const relojProvider = { provide: RELOJ, useValue: (() => new Date()) as Reloj };
