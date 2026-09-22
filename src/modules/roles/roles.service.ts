import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Rol } from './entities/rol.entity.js';

@Injectable()
export class RolesService extends CrudService<Rol> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Rol), 'id_rol');
  }
}
