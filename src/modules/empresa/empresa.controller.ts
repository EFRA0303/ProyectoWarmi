import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { paginatedSchema } from '../../common/swagger/paginated-schema.js';
import {
  CreateConfiguracionDocumentoDto,
  CreateEmpresaDto,
  UpdateConfiguracionDocumentoDto,
  UpdateEmpresaDto,
} from './dto/empresa.dto.js';
import { EmpresaService } from './empresa.service.js';
import {
  ConfiguracionDocumento,
  Empresa,
} from './entities/empresa.entities.js';
@ApiTags('Empresa y configuracion')
@ApiBearerAuth('access-token')
@ApiExtraModels(Empresa, ConfiguracionDocumento)
@Controller('empresa')
export class EmpresaController {
  constructor(
    @Inject(EmpresaService) private readonly service: EmpresaService,
  ) {}
  @Post() @Permissions('empresa.crear') create(@Body() dto: CreateEmpresaDto) {
    return this.service.create(dto);
  }
  @Get()
  @Permissions('empresa.leer')
  @ApiOkResponse({ schema: paginatedSchema(Empresa) })
  list(@Query() q: DomainQueryDto) {
    return this.service.list(q);
  }
  @Get(':id') @Permissions('empresa.leer') one(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.one(id);
  }
  @Patch(':id') @Permissions('empresa.actualizar') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateEmpresaDto,
  ) {
    return this.service.update(id, dto);
  }
  @Post('configuraciones-documentos')
  @Permissions('empresa.crear')
  createConfig(@Body() dto: CreateConfiguracionDocumentoDto) {
    return this.service.createConfig(dto);
  }
  @Get('configuraciones-documentos/listar')
  @Permissions('empresa.leer')
  @ApiOkResponse({ schema: paginatedSchema(ConfiguracionDocumento) })
  listConfigs(@Query() q: DomainQueryDto) {
    return this.service.listConfigs(q);
  }
  @Get('configuraciones-documentos/:id') @Permissions('empresa.leer') oneConfig(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.oneConfig(id);
  }
  @Patch('configuraciones-documentos/:id')
  @Permissions('empresa.actualizar')
  updateConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConfiguracionDocumentoDto,
  ) {
    return this.service.updateConfig(id, dto);
  }
}
