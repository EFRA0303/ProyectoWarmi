import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { ConfiguracionAuditoria } from './entities/configuracion-auditoria.entity.js';
import type { DeepPartial } from 'typeorm';

@Injectable()
export class ConfiguracionAuditoriaService extends CrudService<ConfiguracionAuditoria> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(ConfiguracionAuditoria), 'id_configuracion');
  }

  protected async validate(
    data: DeepPartial<ConfiguracionAuditoria>,
    _actor: number,
    current?: ConfiguracionAuditoria,
  ) {
    if (current?.es_obligatorio && data.habilitado === false)
      throw new BadRequestException(
        'No puedes deshabilitar un evento obligatorio',
      );
  }
}
