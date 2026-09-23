import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import type { Request } from 'express';
import { AuthService } from '../auth.service.js';
import { requestMetadata } from '../../../common/interfaces/request-metadata.interface.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {
    super({
      usernameField: 'correo_acceso',
      passwordField: 'contrasena',
      passReqToCallback: true,
    });
  }
  validate(request: Request, email: string, password: string) {
    return this.auth.validateCredentials(
      email,
      password,
      requestMetadata(request),
    );
  }
}
