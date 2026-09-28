import { z } from 'zod';

/** CUIT argentino: 11 dígitos sin guiones. */
export const CuitSchema = z
  .string()
  .regex(/^\d{11}$/, 'El CUIT debe tener 11 dígitos, sin guiones.');
