import { Injectable, Inject } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, ExtractJwt } from 'passport-jwt';
import { jwtConfig } from '../../../config/jwt.config.js';
import type { JwtPayload } from '../../../common/interfaces/jwt-payload.interface.js';
import { AuthService } from '../auth.service.js';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: jwtConfig().secret,
      algorithms: ['HS256'],
    });
  }
  validate(payload: JwtPayload) {
    return this.auth.validateToken(payload);
  }
}
