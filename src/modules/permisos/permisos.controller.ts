import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
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
import { SincronizarPermisosUsuarioDto } from './dto/sincronizar-permisos-usuario.dto.js';

@ApiBearerAuth('access-token')
@Controller('permisos')
export class PermisosController {
  constructor(
    @Inject(PermisosService) private readonly service: PermisosService,
    @Inject(AssignmentsService)
    private readonly assignments: AssignmentsService,
  ) {}

  @Post('usuarios')
  @Permissions('permisos.asignar')
  @ApiOperation({
    summary: 'Conceder o denegar un permiso individual',
    description:
      'Configura una excepción de permiso específica para el usuario indicado.',
  })
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
  @ApiOperation({ summary: 'Listar permisos individuales de un usuario' })
  permissions(@Param('id', ParseIntPipe) id: number) {
    return this.assignments.forUser(id);
  }
  @Put('usuarios/:id')
  @Permissions('permisos.asignar')
  @ApiOperation({ summary: 'Reemplazar las excepciones de permisos de un usuario' })
  syncUserPermissions(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SincronizarPermisosUsuarioDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.assignments.syncUser(id, dto.excepciones, user.sub);
  }

  @Post()
  @Permissions('permisos.crear')
  @ApiOperation({ summary: 'Crear un permiso' })
  create(@Body() dto: CreatePermisoDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
  @Get()
  @Permissions('permisos.leer')
  @ApiOperation({ summary: 'Listar permisos' })
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @Permissions('permisos.leer')
  @ApiOperation({ summary: 'Consultar un permiso por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions('permisos.actualizar')
  @ApiOperation({ summary: 'Actualizar un permiso' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermisoDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
  @Patch(':id/baja')
  @Permissions('permisos.actualizar')
  @ApiOperation({
    summary: 'Dar de baja o reactivar un permiso',
    description:
      'Cambia el estado del permiso y registra el motivo cuando se efectúa la baja.',
  })
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deactivate(id, user.sub, dto.motivo_baja);
  }
}
