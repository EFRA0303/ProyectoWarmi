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
import { UsuariosService } from './usuarios.service.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { BajaDto } from '../../common/dto/baja.dto.js';

@Controller('usuarios')
export class UsuariosController {
  constructor(
    @Inject(UsuariosService) private readonly service: UsuariosService,
  ) {}

  @Post()
  @Permissions('usuarios.crear', 'roles.asignar')
  create(@Body() dto: CreateUsuarioDto, @CurrentUser() user: JwtPayload) {
    return this.service.register(dto, user.sub);
  }
  @Get()
  @Permissions('usuarios.leer')
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @Permissions('usuarios.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions('usuarios.actualizar')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() user: JwtPayload,
  ) {
    if (dto.correo_acceso) dto.correo_acceso = dto.correo_acceso.toLowerCase();
    return this.service.update(id, dto, user.sub);
  }
  @Patch(':id/baja')
  @Permissions('usuarios.actualizar')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deactivate(id, user.sub, dto.motivo_baja);
  }
}
