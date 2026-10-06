import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Paciente } from './entities/paciente.entity.js';
import { Persona } from '../personas/entities/persona.entity.js';
import type { RegistroCompletoPacienteDto } from './dto/registro-completo-paciente.dto.js';
import type { PacienteQueryDto } from './dto/paciente-query.dto.js';
import type { ActualizacionCompletaPacienteDto } from './dto/actualizacion-completa-paciente.dto.js';
import type { CambiarEstadoRegistroDto } from '../../common/dto/cambiar-estado-registro.dto.js';
import type { RequestMetadata } from '../../common/interfaces/request-metadata.interface.js';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import { EstadoUsuario } from '../../common/enums/estado-usuario.enum.js';
import { Usuario } from '../usuarios/entities/usuario.entity.js';
import { Auditoria } from '../auditoria/entities/auditoria.entity.js';
import { AuditEvent } from '../../common/enums/audit-event.enum.js';

@Injectable()
export class PacientesService extends CrudService<Paciente> {
  constructor(@Inject(DataSource) private readonly db: DataSource) {
    super(db.getRepository(Paciente), 'id_paciente');
  }

  async registerComplete(dto: RegistroCompletoPacienteDto, actor: number) {
    return this.db.transaction(async (manager) => {
      const personaRepository = manager.getRepository(Persona);
      const pacienteRepository = manager.getRepository(Paciente);
      const persona = await personaRepository.save(
        personaRepository.create(
          Object.assign({}, dto.persona, {
            created_by: actor,
            updated_by: null,
          }),
        ),
      );
      const paciente = await pacienteRepository.save(
        pacienteRepository.create({
          id_persona: persona.id_persona,
          ocupacion: dto.ocupacion ?? null,
          created_by: actor,
          updated_by: null,
        }),
      );
      return pacienteRepository.findOneOrFail({
        where: { id_paciente: paciente.id_paciente },
        relations: { persona: true },
      });
    });
  }

  async updateComplete(
    id: number,
    dto: ActualizacionCompletaPacienteDto,
    actor: number,
  ) {
    return this.db.transaction(async (manager) => {
      const pacienteRepository = manager.getRepository(Paciente);
      const personaRepository = manager.getRepository(Persona);
      const paciente = await pacienteRepository.findOne({
        where: { id_paciente: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!paciente) throw new NotFoundException('Registro no encontrado');

      const persona = await personaRepository.findOneOrFail({
        where: { id_persona: paciente.id_persona },
        lock: { mode: 'pessimistic_write' },
      });
      personaRepository.merge(persona, dto.persona, { updated_by: actor });
      pacienteRepository.merge(paciente, dto.paciente, { updated_by: actor });
      await personaRepository.save(persona);
      await pacienteRepository.save(paciente);

      return pacienteRepository.findOneOrFail({
        where: { id_paciente: id },
        relations: { persona: true },
      });
    });
  }

  async findAllWithPerson({ page, limit, estado, search }: PacienteQueryDto) {
    const query = this.repository
      .createQueryBuilder('paciente')
      .leftJoinAndSelect('paciente.persona', 'persona')
      .leftJoinAndSelect('persona.usuario', 'usuario');

    if (estado) query.andWhere('paciente.estado = :estado', { estado });
    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      query.andWhere(
        `(
          persona.nombre ILIKE :search
          OR persona.ap_paterno ILIKE :search
          OR persona.ap_materno ILIKE :search
          OR CONCAT_WS(' ', persona.nombre, persona.ap_paterno, persona.ap_materno) ILIKE :search
          OR persona.ci ILIKE :search
          OR persona.telefono1 ILIKE :search
          OR persona.telefono2 ILIKE :search
          OR usuario.correo_acceso ILIKE :search
          OR usuario.nombre_usuario ILIKE :search
        )`,
        { search: `%${normalizedSearch}%` },
      );
    }

    query
      .orderBy('paciente.id_paciente', 'ASC')
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
    updateAccess: boolean,
  ) {
    return this.db.transaction(async (manager) => {
      const patientRepository = manager.getRepository(Paciente);
      const userRepository = manager.getRepository(Usuario);
      const patient = await patientRepository.findOne({
        where: { id_paciente: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!patient) throw new NotFoundException('Registro no encontrado');

      const reason = dto.motivo_baja?.trim();
      if (dto.estado === EstadoGeneral.BAJA && !reason)
        throw new BadRequestException('El motivo de la baja es obligatorio');

      patient.estado = dto.estado;
      patient.motivo_baja = dto.estado === EstadoGeneral.BAJA ? reason! : null;
      patient.updated_by = actor;
      await patientRepository.save(patient);

      let userUpdated = false;
      if (updateAccess) {
        const user = await userRepository.findOne({
          where: { id_persona: patient.id_persona },
          lock: { mode: 'pessimistic_write' },
        });
        if (user) {
          if (user.id_usuario === actor && dto.estado === EstadoGeneral.BAJA)
            throw new BadRequestException(
              'No puedes dar de baja tu propia cuenta',
            );

          user.estado =
            dto.estado === EstadoGeneral.ACTIVO
              ? EstadoUsuario.ACTIVO
              : EstadoUsuario.BAJA;
          user.bloqueado_hasta = null;
          user.motivo_estado =
            dto.estado === EstadoGeneral.BAJA ? reason! : null;
          if (dto.estado === EstadoGeneral.ACTIVO) user.intentos_fallidos = 0;
          user.updated_by = actor;
          await userRepository.save(user);
          userUpdated = true;

          await manager.getRepository(Auditoria).save(
            manager.getRepository(Auditoria).create({
              id_usuario_accion: actor,
              id_usuario_afectado: user.id_usuario,
              accion: AuditEvent.USUARIO_ACTUALIZADO,
              entidad: 'usuarios',
              id_registro: String(user.id_usuario),
              descripcion:
                `${dto.estado === EstadoGeneral.ACTIVO ? 'Cuenta reactivada' : 'Cuenta dada de baja'} junto con el paciente ${id}${reason ? `. Motivo: ${reason}` : ''}`.slice(
                  0,
                  500,
                ),
              ip: metadata.ip,
              user_agent: metadata.userAgent,
            }),
          );
        }
      }

      const updatedPatient = await patientRepository.findOneOrFail({
        where: { id_paciente: id },
        relations: { persona: { usuario: true } },
      });
      return { paciente: updatedPatient, usuario_actualizado: userUpdated };
    });
  }
}
