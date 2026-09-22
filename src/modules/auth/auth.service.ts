import { Injectable, Inject, UnauthorizedException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { EstadoUsuario } from '../../common/enums/estado-usuario.enum.js';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(JwtService) private readonly jwt: JwtService,
  ) {}
  async validateCredentials(
    email: string,
    password: string,
  ): Promise<JwtPayload> {
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.length > 150 ||
      password.length > 72
    )
      throw new UnauthorizedException('Credenciales invalidas');
    const user = await this.db.transaction(async (manager) => {
      const repo = manager.getRepository(Usuario);
      const row = await repo
        .createQueryBuilder('u')
        .addSelect('u.contrasena_hash')
        .where('LOWER(u.correo_acceso) = :email', {
          email: email.toLowerCase(),
        })
        .setLock('pessimistic_write')
        .getOne();
      if (
        !row ||
        row.estado !== EstadoUsuario.ACTIVO ||
        (row.bloqueado_hasta && row.bloqueado_hasta > new Date())
      )
        return null;
      if (!(await verifyPassword(password, row.contrasena_hash))) {
        const count = row.bloqueado_hasta ? 1 : row.intentos_fallidos + 1;
        await repo.update(row.id_usuario, {
          intentos_fallidos: Math.min(count, 255),
          bloqueado_hasta: count >= 5 ? new Date(Date.now() + 900000) : null,
        });
        return null;
      }
      const available = await repo.findOne({
        where: { id_usuario: row.id_usuario },
        relations: { rol: true },
      });
      if (available?.rol.estado !== EstadoGeneral.ACTIVO) return null;
      await repo.update(row.id_usuario, {
        intentos_fallidos: 0,
        bloqueado_hasta: null,
        ultimo_acceso_en: new Date(),
        updated_by: row.id_usuario,
      });
      return row;
    });
    if (!user)
      throw new UnauthorizedException(
        'Credenciales invalidas o cuenta no disponible',
      );
    return {
      sub: user.id_usuario,
      id_rol: user.id_rol,
      passwordVersion: user.cambio_contrasena_en?.getTime() ?? 0,
    };
  }
  async validateToken(payload: JwtPayload): Promise<JwtPayload> {
    if (
      !Number.isInteger(payload.sub) ||
      payload.sub < 1 ||
      !Number.isFinite(payload.passwordVersion)
    )
      throw new UnauthorizedException();
    const user = await this.db.getRepository(Usuario).findOne({
      where: { id_usuario: payload.sub },
      relations: { rol: true },
    });
    if (
      !user ||
      user.estado !== EstadoUsuario.ACTIVO ||
      user.rol.estado !== EstadoGeneral.ACTIVO ||
      (user.bloqueado_hasta && user.bloqueado_hasta > new Date()) ||
      (user.cambio_contrasena_en?.getTime() ?? 0) !== payload.passwordVersion
    )
      throw new UnauthorizedException('Sesion no valida');
    return {
      sub: user.id_usuario,
      id_rol: user.id_rol,
      passwordVersion: payload.passwordVersion,
    };
  }
  async login(user: JwtPayload) {
    return {
      access_token: await this.jwt.signAsync(user),
      token_type: 'Bearer',
    };
  }
  async profile(id: number) {
    return this.db.getRepository(Usuario).findOneOrFail({
      where: { id_usuario: id },
      relations: { persona: true, rol: true },
    });
  }
  async changePassword(id: number, current: string, next: string) {
    await this.db.transaction(async (manager) => {
      const repo = manager.getRepository(Usuario);
      const user = await repo
        .createQueryBuilder('u')
        .addSelect('u.contrasena_hash')
        .where('u.id_usuario = :id', { id })
        .setLock('pessimistic_write')
        .getOne();
      if (!user || !(await verifyPassword(current, user.contrasena_hash)))
        throw new UnauthorizedException('Contrasena actual incorrecta');
      await repo.update(id, {
        contrasena_hash: await hashPassword(next),
        updated_by: id,
        cambio_contrasena_en: new Date(
          Math.max(Date.now(), (user.cambio_contrasena_en?.getTime() ?? 0) + 1),
        ),
        token_recuperacion_hash: null,
        token_recuperacion_expira: null,
      });
    });
    return { message: 'Contrasena actualizada. Inicia sesion nuevamente.' };
  }
}
