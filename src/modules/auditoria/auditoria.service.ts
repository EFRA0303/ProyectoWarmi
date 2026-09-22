import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Auditoria } from './entities/auditoria.entity.js';

@Injectable()
export class AuditoriaService extends CrudService<Auditoria> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Auditoria), 'id_auditoria');
  }
}
