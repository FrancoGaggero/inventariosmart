import { Injectable, Logger, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { Env } from '../config/env';

export interface Correo {
  para: string[];
  asunto: string;
  html: string;
  texto: string;
}

/**
 * Correo transaccional (design D5). `ResendMailer` en producción cuando hay API key;
 * `LogMailer` en desarrollo, tests y cuando falta la key: deja constancia y no falla.
 */
export abstract class Mailer {
  /** true si el proveedor aceptó el envío. Nunca lanza. */
  abstract enviar(correo: Correo): Promise<boolean>;
}

@Injectable()
export class LogMailer extends Mailer {
  private readonly logger = new Logger(LogMailer.name);
  readonly enviados: Correo[] = [];

  async enviar(correo: Correo): Promise<boolean> {
    this.enviados.push(correo);
    this.logger.log(
      { para: correo.para, asunto: correo.asunto },
      'Correo registrado sin proveedor configurado (RESEND_API_KEY ausente)',
    );
    return true;
  }
}

export class ResendMailer extends Mailer {
  private readonly logger = new Logger(ResendMailer.name);
  private readonly resend: Resend;

  constructor(
    apiKey: string,
    private readonly from: string,
  ) {
    super();
    this.resend = new Resend(apiKey);
  }

  async enviar(correo: Correo): Promise<boolean> {
    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: correo.para,
        subject: correo.asunto,
        html: correo.html,
        text: correo.texto,
      });
      if (error) {
        this.logger.warn({ error: error.message, para: correo.para }, 'Resend rechazó el envío');
        return false;
      }
      return true;
    } catch (err) {
      this.logger.warn({ err, para: correo.para }, 'No se pudo enviar el correo');
      return false;
    }
  }
}

export const mailerProvider: Provider = {
  provide: Mailer,
  inject: [ConfigService],
  useFactory: (config: ConfigService<Env, true>): Mailer => {
    const apiKey = config.get('RESEND_API_KEY', { infer: true });
    if (apiKey && config.get('NODE_ENV', { infer: true }) !== 'test') {
      return new ResendMailer(apiKey, config.get('MAIL_FROM', { infer: true }));
    }
    return new LogMailer();
  },
};
