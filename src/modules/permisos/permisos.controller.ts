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
import { PermisosService } from './permisos.service.js';
import { CreatePermisoDto } from './dto/create-permiso.dto.js';
import { UpdatePermisoDto } from './dto/update-permiso.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { BajaDto } from '../../common/dto/baja.dto.js';
import { AssignUserPermissionDto } from './dto/assign-user-permission.dto.js';
import { AssignmentsService } from '../../common/utils/assignments.service.js';

@Controller('permisos')
export class PermisosController {
  constructor(
    @Inject(PermisosService) private readonly service: PermisosService,
    @Inject(AssignmentsService)
    private readonly assignments: AssignmentsService,
  ) {}

  @Post('usuarios')
  @Permissions('permisos.asignar')
  assign(
    @Body() dto: AssignUserPermissionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assignments.user(
      dto.id_usuario,
      dto.id_permiso,
      dto.permitido ?? true,
      user.sub,
    );
  }
  @Get('usuarios/:id')
  @Permissions('permisos.leer')
  permissions(@Param('id', ParseIntPipe) id: number) {
    return this.assignments.forUser(id);
  }

  @Post()
  @Permissions('permisos.crear')
  create(@Body() dto: CreatePermisoDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
  @Get()
  @Permissions('permisos.leer')
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @Permissions('permisos.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions('permisos.actualizar')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermisoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
  @Patch(':id/baja')
  @Permissions('permisos.actualizar')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deactivate(id, user.sub, dto.motivo_baja);
  }
}
