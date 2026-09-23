import {
  BadRequestException,
  Injectable,
  Inject,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { EstadoUsuario } from '../../common/enums/estado-usuario.enum.js';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import { hashPassword, verifyPassword } from '../../common/utils/password.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { MailService } from './mail.service.js';
import { mailConfig } from '../../config/mail.config.js';
import { AccesosUsuarioService } from '../accesos-usuario/accesos-usuario.service.js';
import { AuditEvent } from '../../common/enums/audit-event.enum.js';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface.js';
import { Auditoria } from '../auditoria/entities/auditoria.entity.js';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DataSource) private readonly db: DataSource,
    @Inject(JwtService) private readonly jwt: JwtService,
    @Inject(MailService) private readonly mail: MailService,
    @Inject(AccesosUsuarioService)
    private readonly accesses: AccesosUsuarioService,
  ) {}
  async validateCredentials(
    email: string,
    password: string,
    metadata: RequestMetadata,
  ): Promise<JwtPayload> {
    const identifier =
      typeof email === 'string' ? email.toLowerCase().slice(0, 150) : null;
    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      email.length > 150 ||
      password.length > 72
    ) {
      await this.db.transaction((manager) =>
        this.accesses.record(manager, AuditEvent.LOGIN_FALLIDO, {
          userId: null,
          identifier,
          successful: false,
          failureReason: 'FORMATO_INVALIDO',
          ...metadata,
        }),
      );
      throw new UnauthorizedException('Credenciales invalidas');
    }
    const payload = await this.db.transaction(async (manager) => {
      const repo = manager.getRepository(Usuario);
      const row = await repo
        .createQueryBuilder('u')
        .addSelect('u.contrasena_hash')
        .where('LOWER(u.correo_acceso) = :email', {
          email: email.toLowerCase(),
        })
        .setLock('pessimistic_write')
        .getOne();
      if (!row) {
        await this.accesses.record(manager, AuditEvent.LOGIN_FALLIDO, {
          userId: null,
          identifier,
          successful: false,
          failureReason: 'CREDENCIALES_INVALIDAS',
          ...metadata,
        });
        return null;
      }
      if (row.estado !== EstadoUsuario.ACTIVO) {
        await this.accesses.record(manager, AuditEvent.LOGIN_FALLIDO, {
          userId: row.id_usuario,
          identifier,
          successful: false,
          failureReason: 'CUENTA_NO_DISPONIBLE',
          ...metadata,
        });
        return null;
      }
      if (row.bloqueado_hasta && row.bloqueado_hasta > new Date()) {
        await this.accesses.record(manager, AuditEvent.LOGIN_FALLIDO, {
          userId: row.id_usuario,
          identifier,
          successful: false,
          failureReason: 'CUENTA_BLOQUEADA',
          ...metadata,
        });
        return null;
      }
      if (!(await verifyPassword(password, row.contrasena_hash))) {
        const count = row.bloqueado_hasta ? 1 : row.intentos_fallidos + 1;
        const blocked = count >= 5;
        await repo.update(row.id_usuario, {
          intentos_fallidos: Math.min(count, 255),
          bloqueado_hasta: blocked ? new Date(Date.now() + 900000) : null,
        });
        await this.accesses.record(manager, AuditEvent.LOGIN_FALLIDO, {
          userId: row.id_usuario,
          identifier,
          successful: false,
          failureReason: 'CREDENCIALES_INVALIDAS',
          ...metadata,
        });
        if (blocked)
          await this.accesses.record(manager, AuditEvent.USUARIO_BLOQUEADO, {
            userId: row.id_usuario,
            identifier,
            successful: false,
            failureReason: 'USUARIO_BLOQUEADO',
            ...metadata,
          });
        return null;
      }
      const available = await repo.findOne({
        where: { id_usuario: row.id_usuario },
        relations: { rol: true },
      });
      if (available?.rol.estado !== EstadoGeneral.ACTIVO) {
        await this.accesses.record(manager, AuditEvent.LOGIN_FALLIDO, {
          userId: row.id_usuario,
          identifier,
          successful: false,
          failureReason: 'ROL_NO_DISPONIBLE',
          ...metadata,
        });
        return null;
      }
      const loginAt = new Date();
      await repo.update(row.id_usuario, {
        intentos_fallidos: 0,
        bloqueado_hasta: null,
        ultimo_acceso_en: loginAt,
        updated_by: row.id_usuario,
      });
      const access = await this.accesses.record(
        manager,
        AuditEvent.LOGIN_EXITOSO,
        {
          userId: row.id_usuario,
          identifier,
          successful: true,
          ...metadata,
        },
      );
      return {
        sub: row.id_usuario,
        id_rol: row.id_rol,
        passwordVersion: row.cambio_contrasena_en?.getTime() ?? 0,
        accessId: access?.id_acceso,
      };
    });
    if (!payload)
      throw new UnauthorizedException(
        'Credenciales invalidas o cuenta no disponible',
      );
    return payload;
  }
  async validateToken(payload: JwtPayload): Promise<JwtPayload> {
    if (
      !Number.isInteger(payload.sub) ||
      payload.sub < 1 ||
      !Number.isFinite(payload.passwordVersion) ||
      (payload.accessId !== undefined &&
        !/^[1-9][0-9]*$/.test(payload.accessId))
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
    if (
      payload.accessId &&
      (await this.accesses.isClosedSession(user.id_usuario, payload.accessId))
    )
      throw new UnauthorizedException('Sesion cerrada');
    return {
      sub: user.id_usuario,
      id_rol: user.id_rol,
      passwordVersion: payload.passwordVersion,
      accessId: payload.accessId,
    };
  }
  async login(user: JwtPayload) {
    return {
      access_token: await this.jwt.signAsync(user),
      token_type: 'Bearer',
    };
  }
  async logout(user: JwtPayload) {
    await this.accesses.closeSession(user.sub, user.accessId);
    return { message: 'Sesion cerrada.' };
  }
  async forgotPassword(email: string) {
    const normalizedEmail = email.toLowerCase();
    const token = randomBytes(32).toString('hex');
    const tokenHash = this.hashResetToken(token);
    const expiresAt = new Date(
      Date.now() + mailConfig().resetExpiresMinutes * 60_000,
    );
    const repo = this.db.getRepository(Usuario);
    const user = await repo
      .createQueryBuilder('u')
      .where('LOWER(u.correo_acceso) = :email', { email: normalizedEmail })
      .andWhere('u.estado = :estado', { estado: EstadoUsuario.ACTIVO })
      .getOne();

    if (user) {
      await repo.update(user.id_usuario, {
        token_recuperacion_hash: tokenHash,
        token_recuperacion_expira: expiresAt,
      });
      try {
        await this.mail.sendPasswordReset(user.correo_acceso, token);
      } catch (error) {
        await repo
          .createQueryBuilder()
          .update(Usuario)
          .set({
            token_recuperacion_hash: null,
            token_recuperacion_expira: null,
          })
          .where('id_usuario = :id', { id: user.id_usuario })
          .andWhere('token_recuperacion_hash = :tokenHash', { tokenHash })
          .execute();
        this.logger.error(
          `No se pudo enviar el correo de recuperacion a ${normalizedEmail}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return {
      message:
        'Si la cuenta existe, recibiras un correo con las instrucciones.',
    };
  }
  async resetPassword(token: string, next: string, metadata: RequestMetadata) {
    const tokenHash = this.hashResetToken(token.toLowerCase());
    await this.db.transaction(async (manager) => {
      const repo = manager.getRepository(Usuario);
      const user = await repo
        .createQueryBuilder('u')
        .addSelect('u.token_recuperacion_hash')
        .where('u.token_recuperacion_hash = :tokenHash', { tokenHash })
        .andWhere('u.token_recuperacion_expira > :now', { now: new Date() })
        .andWhere('u.estado = :estado', { estado: EstadoUsuario.ACTIVO })
        .setLock('pessimistic_write')
        .getOne();
      if (!user)
        throw new BadRequestException(
          'El token de recuperacion es invalido o ha expirado',
        );
      await repo.update(user.id_usuario, {
        contrasena_hash: await hashPassword(next),
        intentos_fallidos: 0,
        bloqueado_hasta: null,
        cambio_contrasena_en: new Date(
          Math.max(Date.now(), (user.cambio_contrasena_en?.getTime() ?? 0) + 1),
        ),
        token_recuperacion_hash: null,
        token_recuperacion_expira: null,
        updated_by: user.id_usuario,
      });
      await this.recordAuditEvent(
        manager,
        user.id_usuario,
        'RESTABLECIMIENTO_CONTRASENA',
        metadata,
      );
    });
    return { message: 'Contrasena restablecida. Ya puedes iniciar sesion.' };
  }
  async profile(id: number) {
    return this.db.getRepository(Usuario).findOneOrFail({
      where: { id_usuario: id },
      relations: { persona: true, rol: true },
    });
  }
  async changePassword(
    id: number,
    current: string,
    next: string,
    metadata: RequestMetadata,
  ) {
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
      await this.recordAuditEvent(
        manager,
        id,
        'CAMBIO_CONTRASENA_AUTENTICADO',
        metadata,
      );
    });
    return { message: 'Contrasena actualizada. Inicia sesion nuevamente.' };
  }

  private hashResetToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private async recordAuditEvent(
    manager: EntityManager,
    userId: number,
    description: string,
    metadata: RequestMetadata,
  ) {
    if (
      !(await this.accesses.isEventEnabled(
        AuditEvent.CAMBIO_CONTRASENA,
        manager,
      ))
    )
      return;
    const repository = manager.getRepository(Auditoria);
    await repository.save(
      repository.create({
        id_usuario_accion: userId,
        id_usuario_afectado: userId,
        accion: AuditEvent.CAMBIO_CONTRASENA,
        entidad: 'usuarios',
        id_registro: String(userId),
        descripcion: description,
        ip: metadata.ip,
        user_agent: metadata.userAgent,
      }),
    );
  }
}
