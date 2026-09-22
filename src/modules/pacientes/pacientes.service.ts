import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Paciente } from './entities/paciente.entity.js';

@Injectable()
export class PacientesService extends CrudService<Paciente> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Paciente), 'id_paciente');
  }
}
