import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Permiso } from './entities/permiso.entity.js';

@Injectable()
export class PermisosService extends CrudService<Permiso> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Permiso), 'id_permiso');
  }
}
