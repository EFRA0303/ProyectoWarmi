import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { ConfiguracionAuditoria } from './entities/configuracion-auditoria.entity.js';
import type { DeepPartial } from 'typeorm';
import { MANDATORY_AUDIT_EVENTS } from '../../common/enums/audit-event.enum.js';

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
    const code =
      typeof data.codigo_evento === 'string'
        ? data.codigo_evento.toUpperCase()
        : current?.codigo_evento;
    if (
      current?.es_obligatorio &&
      typeof data.codigo_evento === 'string' &&
      code !== current.codigo_evento
    )
      throw new BadRequestException(
        'No puedes cambiar el codigo de un evento obligatorio',
      );
    if (current?.es_obligatorio && data.habilitado === false)
      throw new BadRequestException(
        'No puedes deshabilitar un evento obligatorio',
      );
    if (code && MANDATORY_AUDIT_EVENTS.has(code)) {
      data.codigo_evento = code;
      data.habilitado = true;
      data.es_obligatorio = true;
    }
  }
}
