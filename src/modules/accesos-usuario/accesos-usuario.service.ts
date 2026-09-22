import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { AccesoUsuario } from './entities/acceso-usuario.entity.js';

@Injectable()
export class AccesosUsuarioService extends CrudService<AccesoUsuario> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(AccesoUsuario), 'id_acceso');
  }
}
