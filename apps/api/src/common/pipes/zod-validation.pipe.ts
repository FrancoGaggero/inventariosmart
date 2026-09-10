import { Injectable, type PipeTransform } from '@nestjs/common';
import type { ZodType } from 'zod';
import { validacion } from '../errors';

/**
 * Valida el body (o params) con un esquema zod compartido con la web.
 * Uso: `@Body(new ZodValidationPipe(OnboardingSchema)) body: Onboarding`.
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodType<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;

    const details: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const campo = issue.path.length ? issue.path.map(String).join('.') : '_';
      if (!details[campo]) details[campo] = issue.message;
    }
    throw validacion('Los datos enviados no son válidos.', details);
  }
}
