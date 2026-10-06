import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Personal } from './entities/personal.entity.js';
import { Persona } from '../personas/entities/persona.entity.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Rol } from '../roles/entities/rol.entity.js';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import { hashPassword } from '../../common/utils/password.js';
import type { RegistroCompletoPersonalDto } from './dto/registro-completo-personal.dto.js';
import type { PersonalQueryDto } from './dto/personal-query.dto.js';
import type { ActualizacionCompletaPersonalDto } from './dto/actualizacion-completa-personal.dto.js';
import type { CambiarEstadoRegistroDto } from '../../common/dto/cambiar-estado-registro.dto.js';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface.js';
import { EstadoUsuario } from '../../common/enums/estado-usuario.enum.js';
import { Auditoria } from '../auditoria/entities/auditoria.entity.js';
import { AuditEvent } from '../../common/enums/audit-event.enum.js';

@Injectable()
export class PersonalService extends CrudService<Personal> {
  constructor(@Inject(DataSource) private readonly db: DataSource) {
    super(db.getRepository(Personal), 'id_personal');
  }

  async registerComplete(dto: RegistroCompletoPersonalDto, actor: number) {
    return this.db.transaction(async (manager) => {
      const personaRepository = manager.getRepository(Persona);
      const usuarioRepository = manager.getRepository(Usuario);
      const personalRepository = manager.getRepository(Personal);
      const persona = await personaRepository.save(
        personaRepository.create(
          Object.assign({}, dto.persona, {
            created_by: actor,
            updated_by: null,
          }),
        ),
      );

      const roleExists = await manager.getRepository(Rol).existsBy({
        id_rol: dto.usuario.id_rol,
        estado: EstadoGeneral.ACTIVO,
      });
      if (!roleExists)
        throw new BadRequestException('El rol no existe o esta inactivo');

      const usuario = await usuarioRepository.save(
        usuarioRepository.create({
          id_persona: persona.id_persona,
          id_rol: dto.usuario.id_rol,
          correo_acceso: dto.usuario.correo_acceso.toLowerCase(),
          nombre_usuario: dto.usuario.nombre_usuario ?? null,
          contrasena_hash: await hashPassword(dto.usuario.contrasena),
          created_by: actor,
          updated_by: null,
        }),
      );
      const personal = await personalRepository.save(
        personalRepository.create(
          Object.assign({}, dto.personal, {
            id_usuario: usuario.id_usuario,
            created_by: actor,
            updated_by: null,
          }),
        ),
      );
      return personalRepository.findOneOrFail({
        where: { id_personal: personal.id_personal },
        relations: { usuario: { persona: true, rol: true } },
      });
    });
  }

  async updateComplete(
    id: number,
    dto: ActualizacionCompletaPersonalDto,
    actor: number,
  ) {
    return this.db.transaction(async (manager) => {
      const personalRepository = manager.getRepository(Personal);
      const usuarioRepository = manager.getRepository(Usuario);
      const personaRepository = manager.getRepository(Persona);
      const personal = await personalRepository.findOne({
        where: { id_personal: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!personal) throw new NotFoundException('Registro no encontrado');

      const usuario = await usuarioRepository.findOneOrFail({
        where: { id_usuario: personal.id_usuario },
        lock: { mode: 'pessimistic_write' },
      });
      const persona = await personaRepository.findOneOrFail({
        where: { id_persona: usuario.id_persona },
        lock: { mode: 'pessimistic_write' },
      });

      personaRepository.merge(persona, dto.persona, { updated_by: actor });
      usuarioRepository.merge(usuario, dto.usuario, {
        correo_acceso: dto.usuario.correo_acceso?.toLowerCase(),
        updated_by: actor,
      });
      personalRepository.merge(personal, dto.personal, { updated_by: actor });
      await personaRepository.save(persona);
      await usuarioRepository.save(usuario);
      await personalRepository.save(personal);

      return personalRepository.findOneOrFail({
        where: { id_personal: id },
        relations: { usuario: { persona: true, rol: true } },
      });
    });
  }

  async findAllWithDetails({ page, limit, estado, search }: PersonalQueryDto) {
    const query = this.repository
      .createQueryBuilder('personal')
      .leftJoinAndSelect('personal.usuario', 'usuario')
      .leftJoinAndSelect('usuario.persona', 'persona')
      .leftJoinAndSelect('usuario.rol', 'rol');

    if (estado) query.andWhere('personal.estado = :estado', { estado });
    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      query.andWhere(
        `(
          persona.nombre ILIKE :search
          OR persona.ap_paterno ILIKE :search
          OR persona.ap_materno ILIKE :search
          OR CONCAT_WS(' ', persona.nombre, persona.ap_paterno, persona.ap_materno) ILIKE :search
          OR persona.ci ILIKE :search
          OR usuario.correo_acceso ILIKE :search
          OR usuario.nombre_usuario ILIKE :search
          OR personal.profesion ILIKE :search
          OR personal.cargo ILIKE :search
        )`,
        { search: `%${normalizedSearch}%` },
      );
    }

    query
      .orderBy('personal.id_personal', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }

  async changeStatus(
    id: number,
    dto: CambiarEstadoRegistroDto,
    actor: number,
    metadata: RequestMetadata,
  ) {
    return this.db.transaction(async (manager) => {
      const staffRepository = manager.getRepository(Personal);
      const userRepository = manager.getRepository(Usuario);
      const staff = await staffRepository.findOne({
        where: { id_personal: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!staff) throw new NotFoundException('Registro no encontrado');

      const reason = dto.motivo_baja?.trim();
      if (dto.estado === EstadoGeneral.BAJA && !reason)
        throw new BadRequestException('El motivo de la baja es obligatorio');

      const user = await userRepository.findOne({
        where: { id_usuario: staff.id_usuario },
        lock: { mode: 'pessimistic_write' },
      });
      if (!user)
        throw new NotFoundException('La cuenta del empleado no existe');
      if (user.id_usuario === actor && dto.estado === EstadoGeneral.BAJA)
        throw new BadRequestException('No puedes dar de baja tu propia cuenta');

      staff.estado = dto.estado;
      staff.motivo_baja = dto.estado === EstadoGeneral.BAJA ? reason! : null;
      staff.updated_by = actor;
      await staffRepository.save(staff);

      user.estado =
        dto.estado === EstadoGeneral.ACTIVO
          ? EstadoUsuario.ACTIVO
          : EstadoUsuario.BAJA;
      user.bloqueado_hasta = null;
      user.motivo_estado = dto.estado === EstadoGeneral.BAJA ? reason! : null;
      if (dto.estado === EstadoGeneral.ACTIVO) user.intentos_fallidos = 0;
      user.updated_by = actor;
      await userRepository.save(user);

      const auditRepository = manager.getRepository(Auditoria);
      await auditRepository.save(
        auditRepository.create({
          id_usuario_accion: actor,
          id_usuario_afectado: user.id_usuario,
          accion: AuditEvent.USUARIO_ACTUALIZADO,
          entidad: 'usuarios',
          id_registro: String(user.id_usuario),
          descripcion:
            `${dto.estado === EstadoGeneral.ACTIVO ? 'Cuenta reactivada' : 'Cuenta dada de baja'} junto con el personal ${id}${reason ? `. Motivo: ${reason}` : ''}`.slice(
              0,
              500,
            ),
          ip: metadata.ip,
          user_agent: metadata.userAgent,
        }),
      );

      return staffRepository.findOneOrFail({
        where: { id_personal: id },
        relations: { usuario: { persona: true, rol: true } },
      });
    });
  }
}
