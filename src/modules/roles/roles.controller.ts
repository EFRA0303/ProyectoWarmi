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
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { RolesService } from './roles.service.js';
import { CreateRolDto } from './dto/create-rol.dto.js';
import { UpdateRolDto } from './dto/update-rol.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { BajaDto } from '../../common/dto/baja.dto.js';
import { AssignPermissionDto } from './dto/assign-permission.dto.js';
import { AssignmentsService } from '../../common/utils/assignments.service.js';

@ApiBearerAuth('access-token')
@Controller('roles')
export class RolesController {
  constructor(
    @Inject(RolesService) private readonly service: RolesService,
    @Inject(AssignmentsService)
    private readonly assignments: AssignmentsService,
  ) {}

  @Post(':id/permisos')
  @Permissions('roles.asignar')
  @ApiOperation({ summary: 'Asignar un permiso a un rol' })
  assign(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignPermissionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assignments.role(id, dto.id_permiso, user.sub);
  }
  @Get(':id/permisos')
  @Permissions('roles.leer')
  @ApiOperation({ summary: 'Listar los permisos asignados a un rol' })
  permissions(@Param('id', ParseIntPipe) id: number) {
    return this.assignments.forRole(id);
  }

  @Post()
  @Permissions('roles.crear')
  @ApiOperation({ summary: 'Crear un rol' })
  create(@Body() dto: CreateRolDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
  @Get()
  @Permissions('roles.leer')
  @ApiOperation({ summary: 'Listar roles' })
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @Permissions('roles.leer')
  @ApiOperation({ summary: 'Consultar un rol por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions('roles.actualizar')
  @ApiOperation({ summary: 'Actualizar un rol' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRolDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
  @Patch(':id/baja')
  @Permissions('roles.actualizar')
  @ApiOperation({
    summary: 'Dar de baja o reactivar un rol',
    description:
      'Cambia el estado del rol y registra el motivo cuando se efectúa la baja.',
  })
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deactivate(id, user.sub, dto.motivo_baja);
  }
}
