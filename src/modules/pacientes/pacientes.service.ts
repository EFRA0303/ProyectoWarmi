import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Paciente } from './entities/paciente.entity.js';
import { Persona } from '../personas/entities/persona.entity.js';
import type { RegistroCompletoPacienteDto } from './dto/registro-completo-paciente.dto.js';
import type { PacienteQueryDto } from './dto/paciente-query.dto.js';
import type { ActualizacionCompletaPacienteDto } from './dto/actualizacion-completa-paciente.dto.js';

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
      .leftJoinAndSelect('paciente.persona', 'persona');

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
}
