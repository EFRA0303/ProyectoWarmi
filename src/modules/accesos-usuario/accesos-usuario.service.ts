import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { AccesoUsuario } from './entities/acceso-usuario.entity.js';
import { ConfiguracionAuditoria } from '../configuracion-auditoria/entities/configuracion-auditoria.entity.js';
import {
  AuditEvent,
  MANDATORY_AUDIT_EVENTS,
} from '../../common/enums/audit-event.enum.js';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface.js';
import type { AccessQueryDto } from './dto/access-query.dto.js';

interface AccessEventData extends RequestMetadata {
  userId: number | null;
  identifier: string | null;
  successful: boolean;
  failureReason?: string | null;
}

@Injectable()
export class AccesosUsuarioService {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}

  async isEventEnabled(event: AuditEvent, manager = this.db.manager) {
    if (MANDATORY_AUDIT_EVENTS.has(event)) return true;
    const config = await manager.getRepository(ConfiguracionAuditoria).findOne({
      where: { codigo_evento: event },
    });
    return config?.habilitado ?? false;
  }

  async record(
    manager: EntityManager,
    event: AuditEvent,
    data: AccessEventData,
  ): Promise<AccesoUsuario | null> {
    if (!(await this.isEventEnabled(event, manager))) return null;
    const repository = manager.getRepository(AccesoUsuario);
    return repository.save(
      repository.create({
        id_usuario: data.userId,
        identificador_intento: data.identifier?.slice(0, 150) ?? null,
        login_exitoso: data.successful,
        motivo_fallo: data.failureReason?.slice(0, 100) ?? null,
        ip: data.ip,
        user_agent: data.userAgent,
      }),
    );
  }

  async closeSession(
    userId: number,
    accessId: string | undefined,
  ): Promise<boolean> {
    if (!accessId || !(await this.isEventEnabled(AuditEvent.LOGOUT)))
      return false;
    const result = await this.db
      .getRepository(AccesoUsuario)
      .createQueryBuilder()
      .update()
      .set({ fecha_logout: new Date() })
      .where('id_acceso = :accessId', { accessId })
      .andWhere('id_usuario = :userId', { userId })
      .andWhere('login_exitoso = true')
      .andWhere('fecha_logout IS NULL')
      .execute();
    return Boolean(result.affected);
  }

  async isClosedSession(userId: number, accessId: string) {
    const access = await this.db.getRepository(AccesoUsuario).findOne({
      where: { id_acceso: accessId, id_usuario: userId, login_exitoso: true },
      select: { fecha_logout: true },
    });
    return Boolean(access?.fecha_logout);
  }

  async findAll(query: AccessQueryDto) {
    const { page, limit, id_usuario, login_exitoso } = query;
    const builder = this.db
      .getRepository(AccesoUsuario)
      .createQueryBuilder('access')
      .orderBy('access.fecha_login', 'DESC')
      .addOrderBy('access.id_acceso', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (id_usuario !== undefined)
      builder.andWhere('access.id_usuario = :id_usuario', { id_usuario });
    if (login_exitoso !== undefined)
      builder.andWhere('access.login_exitoso = :login_exitoso', {
        login_exitoso,
      });
    const [data, total] = await builder.getManyAndCount();
    return { data, total, page, limit };
  }

  findByUser(userId: number, query: AccessQueryDto) {
    return this.findAll({
      page: query.page,
      limit: query.limit,
      id_usuario: userId,
      login_exitoso: query.login_exitoso,
    });
  }

  findSuccessful(query: AccessQueryDto) {
    return this.findAll({
      page: query.page,
      limit: query.limit,
      id_usuario: query.id_usuario,
      login_exitoso: true,
    });
  }

  findFailed(query: AccessQueryDto) {
    return this.findAll({
      page: query.page,
      limit: query.limit,
      id_usuario: query.id_usuario,
      login_exitoso: false,
    });
  }

  async findLatestByUser() {
    return this.db
      .getRepository(AccesoUsuario)
      .createQueryBuilder('access')
      .distinctOn(['access.id_usuario'])
      .where('access.id_usuario IS NOT NULL')
      .andWhere('access.login_exitoso = true')
      .orderBy('access.id_usuario', 'ASC')
      .addOrderBy('access.fecha_login', 'DESC')
      .addOrderBy('access.id_acceso', 'DESC')
      .getMany();
  }

  async findOne(id: string) {
    const access = await this.db
      .getRepository(AccesoUsuario)
      .findOneBy({ id_acceso: id });
    if (!access) throw new NotFoundException('Registro no encontrado');
    return access;
  }

  async deleteAll() {
    const result = await this.db
      .getRepository(AccesoUsuario)
      .createQueryBuilder()
      .delete()
      .execute();
    return { eliminados: result.affected ?? 0 };
  }

  async deleteByUser(userId: number) {
    const result = await this.db
      .getRepository(AccesoUsuario)
      .delete({ id_usuario: userId });
    return { eliminados: result.affected ?? 0 };
  }
}
