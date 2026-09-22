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
import { ConfiguracionAuditoriaService } from './configuracion-auditoria.service.js';
import { CreateConfiguracionAuditoriaDto } from './dto/create-configuracion-auditoria.dto.js';
import { UpdateConfiguracionAuditoriaDto } from './dto/update-configuracion-auditoria.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Controller('configuracion-auditoria')
export class ConfiguracionAuditoriaController {
  constructor(
    @Inject(ConfiguracionAuditoriaService)
    private readonly service: ConfiguracionAuditoriaService,
  ) {}

  @Post()
  @Permissions('configuracion-auditoria.crear')
  create(
    @Body() dto: CreateConfiguracionAuditoriaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub);
  }
  @Get()
  @Permissions('configuracion-auditoria.leer')
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @Permissions('configuracion-auditoria.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions('configuracion-auditoria.actualizar')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateConfiguracionAuditoriaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
}
