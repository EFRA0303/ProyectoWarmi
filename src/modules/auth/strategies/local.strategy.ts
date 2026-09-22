import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service.js';

@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {
    super({ usernameField: 'correo_acceso', passwordField: 'contrasena' });
  }
  validate(email: string, password: string) {
    return this.auth.validateCredentials(email, password);
  }
}
