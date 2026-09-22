import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Personal } from './entities/personal.entity.js';

@Injectable()
export class PersonalService extends CrudService<Personal> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Personal), 'id_personal');
  }
}
