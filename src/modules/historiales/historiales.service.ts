import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import { Paciente } from '../pacientes/entities/paciente.entity.js';
import type { CreateHistorialDto } from './dto/create-historial.dto.js';
import type { HistorialQueryDto } from './dto/historial-query.dto.js';
import type { UpdateHistorialDto } from './dto/update-historial.dto.js';
import { Historial } from './entities/historial.entity.js';

@Injectable()
export class HistorialesService {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}

  async create(dto: CreateHistorialDto) {
    return this.db.transaction(async (manager) => {
      const patient = await manager.getRepository(Paciente).findOneBy({
        id_paciente: dto.id_paciente,
      });
      if (!patient) throw new BadRequestException('El paciente no existe');
      if (patient.estado !== EstadoGeneral.ACTIVO)
        throw new BadRequestException('El paciente no esta activo');

      const repository = manager.getRepository(Historial);
      if (await repository.existsBy({ id_paciente: dto.id_paciente }))
        throw new ConflictException('El paciente ya tiene un historial');

      return repository.save(repository.create(dto));
    });
  }

  async findAll({ page, limit, estado }: HistorialQueryDto) {
    const [data, total] = await this.db.getRepository(Historial).findAndCount({
      where: estado ? { estado } : {},
      order: { id_historial: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findOne(id: number) {
    const history = await this.db
      .getRepository(Historial)
      .findOneBy({ id_historial: id });
    if (!history) throw new NotFoundException('Registro no encontrado');
    return history;
  }

  async update(id: number, dto: UpdateHistorialDto) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(Historial);
      const history = await repository.findOne({
        where: { id_historial: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!history) throw new NotFoundException('Registro no encontrado');
      return repository.save(repository.merge(history, dto));
    });
  }
}
