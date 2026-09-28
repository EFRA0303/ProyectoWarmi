import { Inject, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import type {
  CreateConfiguracionDocumentoDto,
  CreateEmpresaDto,
  UpdateConfiguracionDocumentoDto,
  UpdateEmpresaDto,
} from './dto/empresa.dto.js';
import {
  ConfiguracionDocumento,
  Empresa,
} from './entities/empresa.entities.js';
@Injectable()
export class EmpresaService {
  private readonly empresas: DomainResourceService<Empresa>;
  private readonly configs: DomainResourceService<ConfiguracionDocumento>;
  constructor(@Inject(DataSource) db: DataSource) {
    this.empresas = new DomainResourceService(
      Empresa,
      'id_empresa',
      db.getRepository(Empresa),
      'Empresa',
    );
    this.configs = new DomainResourceService(
      ConfiguracionDocumento,
      'id_configuracion',
      db.getRepository(ConfiguracionDocumento),
      'Configuracion de documento',
    );
  }
  create(dto: CreateEmpresaDto) {
    return this.empresas.create(dto);
  }
  list(q: DomainQueryDto) {
    return this.empresas.list(q);
  }
  one(id: number) {
    return this.empresas.one(id);
  }
  update(id: number, dto: UpdateEmpresaDto) {
    return this.empresas.update(id, dto);
  }
  createConfig(dto: CreateConfiguracionDocumentoDto) {
    return this.configs.create(dto);
  }
  listConfigs(q: DomainQueryDto) {
    return this.configs.list(q);
  }
  oneConfig(id: number) {
    return this.configs.one(id);
  }
  updateConfig(id: number, dto: UpdateConfiguracionDocumentoDto) {
    return this.configs.update(id, dto);
  }
}
