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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { paginatedSchema } from '../../common/swagger/paginated-schema.js';
import {
  CreateConfiguracionDocumentoDto,
  CreateEmpresaDto,
  UpdateConfiguracionDocumentoDto,
  UpdateEmpresaDto,
  UpdateHorarioAtencionDto,
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
@Roles('ROOT', 'ADMINISTRADOR')
export class EmpresaController {
  constructor(
    @Inject(EmpresaService) private readonly service: EmpresaService,
  ) {}
  @Post()
  @Permissions('empresa.crear')
  @ApiOperation({ summary: 'Registrar una empresa' })
  create(@Body() dto: CreateEmpresaDto) {
    return this.service.create(dto);
  }
  @Get()
  @Permissions('empresa.leer')
  @ApiOperation({ summary: 'Listar empresas registradas' })
  @ApiOkResponse({ schema: paginatedSchema(Empresa) })
  list(@Query() q: DomainQueryDto) {
    return this.service.list(q);
  }
  @Public()
  @Get('identidad-publica')
  @ApiOperation({
    summary: 'Consultar la identidad publica de la empresa para el acceso',
  })
  publicIdentity() {
    return this.service.publicIdentity();
  }
  @Public()
  @Get('logo-publico')
  @ApiOperation({ summary: 'Obtener el logo publico de la empresa' })
  async publicLogo() {
    const data = await this.service.getPublicLogo();
    return new StreamableFile(data, {
      type: 'image/webp',
      length: data.length,
      disposition: 'inline',
    });
  }
  @Public()
  @Get('fondo-login-publico')
  @ApiOperation({ summary: 'Obtener la imagen publica del fondo del acceso' })
  async publicLoginBackground() {
    const data = await this.service.getPublicLoginBackground();
    return new StreamableFile(data, {
      type: 'image/webp',
      length: data.length,
      disposition: 'inline',
    });
  }
  @Public()
  @Get('fondo-panel-login-publico')
  @ApiOperation({
    summary: 'Obtener la imagen publica del panel derecho del acceso',
  })
  async publicLoginPanelBackground() {
    const data = await this.service.getPublicLoginPanelBackground();
    return new StreamableFile(data, {
      type: 'image/webp',
      length: data.length,
      disposition: 'inline',
    });
  }
  @Get('monedas/listar')
  @Permissions('empresa.leer')
  @ApiOperation({ summary: 'Listar monedas ISO 4217 disponibles' })
  listCurrencies() {
    return this.service.listCurrencies();
  }
  @Get('horario-atencion')
  @Permissions('empresa.leer')
  @ApiOperation({ summary: 'Consultar el horario general de atención' })
  businessHours() {
    return this.service.getBusinessHours();
  }
  @Patch('horario-atencion')
  @Permissions('empresa.actualizar')
  @ApiOperation({ summary: 'Actualizar el horario general de atención' })
  updateBusinessHours(@Body() dto: UpdateHorarioAtencionDto) {
    return this.service.updateBusinessHours(dto);
  }
  @Get(':id')
  @Permissions('empresa.leer')
  @ApiOperation({ summary: 'Consultar una empresa por ID' })
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.one(id);
  }
  @Patch(':id')
  @Permissions('empresa.actualizar')
  @ApiOperation({ summary: 'Actualizar los datos de una empresa' })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateEmpresaDto) {
    return this.service.update(id, dto);
  }
  @Post(':id/logo')
  @Permissions('empresa.actualizar')
  @UseInterceptors(
    FileInterceptor('logo', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Guardar el logo institucional en formato WEBP' })
  uploadLogo(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ) {
    return this.service.saveLogo(id, file);
  }
  @Post(':id/fondo-login')
  @Permissions('empresa.actualizar')
  @UseInterceptors(
    FileInterceptor('fondo_login', { limits: { fileSize: 8 * 1024 * 1024 } }),
  )
  @ApiOperation({
    summary: 'Guardar la imagen de fondo del acceso en formato WEBP',
  })
  uploadLoginBackground(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ) {
    return this.service.saveLoginBackground(id, file);
  }
  @Post(':id/fondo-panel-login')
  @Permissions('empresa.actualizar')
  @UseInterceptors(
    FileInterceptor('fondo_panel_login', {
      limits: { fileSize: 8 * 1024 * 1024 },
    }),
  )
  @ApiOperation({
    summary: 'Guardar el fondo del panel derecho del acceso en formato WEBP',
  })
  uploadLoginPanelBackground(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ) {
    return this.service.saveLoginPanelBackground(id, file);
  }
  @Get(':id/logo')
  @Permissions('empresa.leer')
  @ApiOperation({ summary: 'Obtener el logo institucional' })
  async logo(@Param('id', ParseIntPipe) id: number) {
    const data = await this.service.getLogo(id);
    return new StreamableFile(data, {
      type: 'image/webp',
      length: data.length,
      disposition: 'inline',
    });
  }
  @Post('configuraciones-documentos')
  @Permissions('empresa.crear')
  @ApiOperation({
    summary: 'Crear una configuración de documentos',
    description:
      'Define la numeración y los datos usados para emitir documentos de una empresa.',
  })
  createConfig(@Body() dto: CreateConfiguracionDocumentoDto) {
    return this.service.createConfig(dto);
  }
  @Get('configuraciones-documentos/listar')
  @Permissions('empresa.leer')
  @ApiOperation({ summary: 'Listar configuraciones de documentos' })
  @ApiOkResponse({ schema: paginatedSchema(ConfiguracionDocumento) })
  listConfigs(@Query() q: DomainQueryDto) {
    return this.service.listConfigs(q);
  }
  @Get('configuraciones-documentos/:id')
  @Permissions('empresa.leer')
  @ApiOperation({ summary: 'Consultar una configuración por ID' })
  oneConfig(@Param('id', ParseIntPipe) id: number) {
    return this.service.oneConfig(id);
  }
  @Patch('configuraciones-documentos/:id')
  @Permissions('empresa.actualizar')
  @ApiOperation({ summary: 'Actualizar una configuración de documentos' })
  updateConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConfiguracionDocumentoDto,
  ) {
    return this.service.updateConfig(id, dto);
  }
}
