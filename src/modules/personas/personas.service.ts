import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Persona } from './entities/persona.entity.js';

@Injectable()
export class PersonasService extends CrudService<Persona> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Persona), 'id_persona');
  }

  async availability(ci?: string, telefono1?: string) {
    const [ciExists, phoneExists] = await Promise.all([
      ci ? this.repository.existsBy({ ci }) : false,
      telefono1 ? this.repository.existsBy({ telefono1 }) : false,
    ]);
    return {
      ci_disponible: ci ? !ciExists : true,
      telefono1_disponible: telefono1 ? !phoneExists : true,
    };
  }
}
