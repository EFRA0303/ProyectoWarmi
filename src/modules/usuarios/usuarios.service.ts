import {
  Injectable,
  Inject,
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Usuario } from './entities/usuario.entity.js';
import type { DeepPartial } from 'typeorm';
import { Rol } from '../roles/entities/rol.entity.js';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import type { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { hashPassword } from '../../common/utils/password.js';
import { TipoUsuario, type UsuarioQueryDto } from './dto/usuario-query.dto.js';
import type { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface.js';
import { Auditoria } from '../auditoria/entities/auditoria.entity.js';
import { AuditEvent } from '../../common/enums/audit-event.enum.js';
import { EstadoUsuario } from '../../common/enums/estado-usuario.enum.js';
import type { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto.js';
import { Paciente } from '../pacientes/entities/paciente.entity.js';

@Injectable()
export class UsuariosService extends CrudService<Usuario> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Usuario), 'id_usuario');
  }

  async findAllWithDetails({
    page,
    limit,
    estado,
    search,
    tipo,
  }: UsuarioQueryDto) {
    const query = this.repository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.persona', 'persona')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoinAndSelect('persona.paciente', 'paciente')
      .leftJoinAndSelect('usuario.personal', 'personal')
      .leftJoin('usuario.creador', 'creador')
      .addSelect('creador.id_usuario')
      .leftJoinAndSelect('creador.persona', 'personaCreador');

    if (estado === EstadoUsuario.BLOQUEADO) {
      query.andWhere(
        '(usuario.estado = :blockedState OR (usuario.estado = :activeState AND usuario.bloqueado_hasta > :now))',
        {
          blockedState: EstadoUsuario.BLOQUEADO,
          activeState: EstadoUsuario.ACTIVO,
          now: new Date(),
        },
      );
    } else if (estado === EstadoUsuario.ACTIVO) {
      query.andWhere(
        'usuario.estado = :estado AND (usuario.bloqueado_hasta IS NULL OR usuario.bloqueado_hasta <= :now)',
        { estado, now: new Date() },
      );
    } else if (estado) {
      query.andWhere('usuario.estado = :estado', { estado });
    }

    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      query.andWhere(
        `(
          persona.nombre ILIKE :search
          OR persona.ap_paterno ILIKE :search
          OR persona.ap_materno ILIKE :search
          OR CONCAT_WS(' ', persona.nombre, persona.ap_paterno, persona.ap_materno) ILIKE :search
          OR usuario.correo_acceso ILIKE :search
          OR usuario.nombre_usuario ILIKE :search
        )`,
        { search: `%${normalizedSearch}%` },
      );
    }

    if (tipo === TipoUsuario.PACIENTE)
      query.andWhere('paciente.id_paciente IS NOT NULL');
    if (tipo === TipoUsuario.PERSONAL)
      query.andWhere('personal.id_personal IS NOT NULL');

    query
      .orderBy('usuario.id_usuario', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);

    const [data, total] = await query.getManyAndCount();
    const onlineCutoff = Date.now() - 2 * 60_000;
    return {
      data: data.map((user) =>
        Object.assign(user, {
          en_linea: Boolean(
            user.ultima_actividad_en &&
            user.ultima_actividad_en.getTime() >= onlineCutoff,
          ),
        }),
      ),
      total,
      page,
      limit,
    };
  }

  async findPresence(ids?: string) {
    const userIds = ids
      ? ids.split(',').map((value) => Number(value.trim()))
      : [];

    if (
      userIds.length > 100 ||
      userIds.some((id) => !Number.isInteger(id) || id <= 0)
    ) {
      throw new BadRequestException('Los usuarios solicitados no son válidos');
    }

    const query = this.repository
      .createQueryBuilder('usuario')
      .select(['usuario.id_usuario', 'usuario.ultima_actividad_en'])
      .orderBy('usuario.id_usuario', 'ASC');

    if (userIds.length) {
      query.where('usuario.id_usuario IN (:...userIds)', { userIds });
    }

    query.addSelect(
      (subQuery) =>
        subQuery
          .select('MAX(acceso.fecha_logout)')
          .from('accesos_usuario', 'acceso')
          .where('acceso.id_usuario = usuario.id_usuario')
          .andWhere('acceso.login_exitoso = true'),
      'ultima_desconexion_en',
    );

    const { entities: users, raw } = await query.getRawAndEntities();
    const onlineCutoff = Date.now() - 2 * 60_000;

    return users.map((user, index) => ({
      id_usuario: user.id_usuario,
      ultima_actividad_en: user.ultima_actividad_en,
      ultima_desconexion_en:
        (raw[index]?.ultima_desconexion_en as string | null) ?? null,
      en_linea: Boolean(
        user.ultima_actividad_en &&
        user.ultima_actividad_en.getTime() >= onlineCutoff,
      ),
    }));
  }

  async findOneWithDetails(id: number) {
    const usuario = await this.repository
      .createQueryBuilder('usuario')
      .leftJoinAndSelect('usuario.persona', 'persona')
      .leftJoinAndSelect('usuario.rol', 'rol')
      .leftJoin('usuario.creador', 'creador')
      .addSelect('creador.id_usuario')
      .leftJoinAndSelect('creador.persona', 'personaCreador')
      .where('usuario.id_usuario = :id', { id })
      .getOne();
    if (!usuario) throw new NotFoundException('Registro no encontrado');
    return usuario;
  }

  async availability(correo?: string, username?: string) {
    const [emailExists, usernameExists] = await Promise.all([
      correo ? this.repository.existsBy({ correo_acceso: correo }) : false,
      username ? this.repository.existsBy({ nombre_usuario: username }) : false,
    ]);
    return {
      correo_disponible: correo ? !emailExists : true,
      nombre_usuario_disponible: username ? !usernameExists : true,
    };
  }

  protected async validate(
    data: DeepPartial<Usuario>,
    actor: number,
    current?: Usuario,
  ) {
    if (
      current?.id_usuario === actor &&
      data.estado &&
      data.estado !== 'ACTIVO'
    )
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    if (
      data.id_rol &&
      !(await this.repository.manager
        .getRepository(Rol)
        .existsBy({ id_rol: data.id_rol, estado: EstadoGeneral.ACTIVO }))
    )
      throw new BadRequestException('El rol no existe o esta inactivo');
  }
  async register(dto: CreateUsuarioDto, actor: number) {
    return this.create(
      {
        id_persona: dto.id_persona,
        id_rol: dto.id_rol,
        correo_acceso: dto.correo_acceso.toLowerCase(),
        nombre_usuario: dto.nombre_usuario,
        contrasena_hash: await hashPassword(dto.contrasena),
      },
      actor,
    );
  }

  async registerPatientAccount(dto: CreateUsuarioDto, actor: number) {
    const patient = await this.repository.manager
      .getRepository(Paciente)
      .findOne({
        where: { id_persona: dto.id_persona, estado: EstadoGeneral.ACTIVO },
      });
    if (!patient)
      throw new BadRequestException(
        'La persona seleccionada no corresponde a un paciente activo',
      );

    if (await this.repository.existsBy({ id_persona: dto.id_persona }))
      throw new ConflictException('El paciente seleccionado ya tiene un usuario');

    return this.register(dto, actor);
  }

  async updateWithAudit(
    id: number,
    data: UpdateUsuarioDto & { estado?: EstadoUsuario },
    actor: number,
    metadata: RequestMetadata,
    auditNote?: string,
  ) {
    return this.repository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Usuario);
      const row = await repo.findOne({
        where: { id_usuario: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Registro no encontrado');

      await this.validate(data, actor, row);
      const changes: string[] = [];
      if (
        data.correo_acceso !== undefined &&
        data.correo_acceso !== row.correo_acceso
      )
        changes.push('correo de acceso');
      if (
        data.nombre_usuario !== undefined &&
        data.nombre_usuario !== row.nombre_usuario
      )
        changes.push('nombre de usuario');
      if (data.id_persona !== undefined && data.id_persona !== row.id_persona)
        changes.push('persona vinculada');
      if (data.estado !== undefined && data.estado !== row.estado)
        changes.push(`estado ${row.estado} → ${data.estado}`);
      if (auditNote?.trim())
        changes.push(`motivo: ${auditNote.trim().slice(0, 255)}`);

      const updated = repo.merge(row, data, { updated_by: actor });
      await repo.save(updated);

      if (changes.length) {
        const auditRepo = manager.getRepository(Auditoria);
        await auditRepo.save(
          auditRepo.create({
            id_usuario_accion: actor,
            id_usuario_afectado: id,
            accion: AuditEvent.USUARIO_ACTUALIZADO,
            entidad: 'usuarios',
            id_registro: String(id),
            descripcion: `Cambios: ${changes.join(', ')}`.slice(0, 500),
            ip: metadata.ip,
            user_agent: metadata.userAgent,
          }),
        );
      }

      return repo.findOneByOrFail({ id_usuario: id });
    });
  }

  async changeAccessStateWithAudit(
    id: number,
    dto: CambiarEstadoUsuarioDto,
    actor: number,
    metadata: RequestMetadata,
  ) {
    return this.repository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(Usuario);
      const row = await repo.findOne({
        where: { id_usuario: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Registro no encontrado');
      if (id === actor && dto.estado !== EstadoUsuario.ACTIVO)
        throw new BadRequestException(
          'No puedes bloquear ni dar de baja tu propia cuenta',
        );

      const reason = dto.motivo?.trim();
      let description: string;
      let action = AuditEvent.USUARIO_ACTUALIZADO;

      if (dto.estado === EstadoUsuario.BLOQUEADO) {
        const blockedUntil = new Date(dto.bloqueado_hasta ?? '');
        if (
          Number.isNaN(blockedUntil.getTime()) ||
          blockedUntil.getTime() <= Date.now()
        )
          throw new BadRequestException(
            'La fecha de bloqueo debe ser posterior a la fecha actual',
          );
        if (!reason)
          throw new BadRequestException('El motivo del bloqueo es obligatorio');

        await repo.update(id, {
          estado: EstadoUsuario.ACTIVO,
          bloqueado_hasta: blockedUntil,
          motivo_estado: reason,
          updated_by: actor,
        });
        action = AuditEvent.USUARIO_BLOQUEADO;
        description = `Bloqueo temporal hasta ${blockedUntil.toISOString()}. Motivo: ${reason}`;
      } else if (dto.estado === EstadoUsuario.BAJA) {
        if (!reason)
          throw new BadRequestException('El motivo de la baja es obligatorio');
        await repo.update(id, {
          estado: EstadoUsuario.BAJA,
          bloqueado_hasta: null,
          motivo_estado: reason,
          updated_by: actor,
        });
        description = `Estado ${row.estado} → BAJA. Motivo: ${reason}`;
      } else {
        await repo.update(id, {
          estado: EstadoUsuario.ACTIVO,
          bloqueado_hasta: null,
          motivo_estado: null,
          intentos_fallidos: 0,
          updated_by: actor,
        });
        description = `Cuenta reactivada. Estado anterior: ${row.estado}`;
      }

      const auditRepo = manager.getRepository(Auditoria);
      await auditRepo.save(
        auditRepo.create({
          id_usuario_accion: actor,
          id_usuario_afectado: id,
          accion: action,
          entidad: 'usuarios',
          id_registro: String(id),
          descripcion: description.slice(0, 500),
          ip: metadata.ip,
          user_agent: metadata.userAgent,
        }),
      );

      return repo.findOneByOrFail({ id_usuario: id });
    });
  }

  deactivateWithAudit(
    id: number,
    actor: number,
    metadata: RequestMetadata,
    reason?: string,
  ) {
    return this.changeAccessStateWithAudit(
      id,
      { estado: EstadoUsuario.BAJA, motivo: reason },
      actor,
      metadata,
    );
  }
}
