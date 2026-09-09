import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  type App,
  cert,
  getApp,
  getApps,
  initializeApp,
  type ServiceAccount,
} from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import type { Env } from '../config/env';
import type { AuthUser } from '../common/decorators/current-user.decorator';

/** Contrato del verificador de tokens; los tests lo reemplazan por un doble. */
export abstract class TokenVerifier {
  abstract verificar(idToken: string): Promise<AuthUser>;
}

/**
 * Verifica ID tokens de Firebase Authentication con firebase-admin (API modular, v14).
 * La credencial llega en FIREBASE_SERVICE_ACCOUNT_JSON (JSON del service account en base64).
 */
@Injectable()
export class FirebaseService extends TokenVerifier implements OnModuleInit {
  private readonly logger = new Logger(FirebaseService.name);
  private app?: App;

  constructor(private readonly config: ConfigService<Env, true>) {
    super();
  }

  onModuleInit(): void {
    const b64 = this.config.get('FIREBASE_SERVICE_ACCOUNT_JSON', { infer: true });
    if (!b64) {
      this.logger.warn(
        'FIREBASE_SERVICE_ACCOUNT_JSON no está definida: toda ruta autenticada responderá 401.',
      );
      return;
    }
    const cuenta = JSON.parse(Buffer.from(b64, 'base64').toString('utf8')) as ServiceAccount & {
      project_id?: string;
    };
    this.app = getApps().length ? getApp() : initializeApp({ credential: cert(cuenta) });
    this.logger.log(
      `Firebase Admin inicializado para el proyecto ${cuenta.projectId ?? cuenta.project_id ?? '?'}`,
    );
  }

  async verificar(idToken: string): Promise<AuthUser> {
    if (!this.app) {
      throw new Error('Firebase Admin no inicializado');
    }
    const decoded = await getAuth(this.app).verifyIdToken(idToken);
    return { uid: decoded.uid, email: decoded.email ?? null };
  }
}
