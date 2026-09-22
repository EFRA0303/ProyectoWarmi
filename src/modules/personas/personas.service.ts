import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Persona } from './entities/persona.entity.js';

@Injectable()
export class PersonasService extends CrudService<Persona> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Persona), 'id_persona');
  }
}
