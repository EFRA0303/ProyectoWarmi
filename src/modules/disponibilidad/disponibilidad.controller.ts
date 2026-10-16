import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { CreatePermisoPersonalDto } from './dto/create-permiso-personal.dto.js';
import { CreateHorarioExtraDto } from './dto/create-horario-extra.dto.js';
import { CreateHorarioPersonalDto } from './dto/create-horario-personal.dto.js';
import {
  PermisoPersonalQueryDto,
  HorarioExtraQueryDto,
  HorarioPersonalQueryDto,
} from './dto/disponibilidad-query.dto.js';
import { UpdatePermisoPersonalDto } from './dto/update-permiso-personal.dto.js';
import { UpdateHorarioExtraDto } from './dto/update-horario-extra.dto.js';
import { UpdateHorarioPersonalDto } from './dto/update-horario-personal.dto.js';
import { ReplaceHorariosPersonalDto } from './dto/replace-horarios-personal.dto.js';
import { DisponibilidadService } from './disponibilidad.service.js';
import { PermisoPersonal } from './entities/permiso-personal.entity.js';
import { HorarioExtraPersonal } from './entities/horario-extra-personal.entity.js';
import { HorarioPersonal } from './entities/horario-personal.entity.js';

const paginatedSchema = (model: string) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: { $ref: model } },
    total: { type: 'integer', example: 1 },
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
  },
  required: ['data', 'total', 'page', 'limit'],
});

@ApiTags('Disponibilidad del personal')
@ApiBearerAuth('access-token')
@ApiExtraModels(HorarioPersonal, HorarioExtraPersonal, PermisoPersonal)
@Controller('disponibilidad')
@Roles('ROOT', 'ADMINISTRADOR')
export class DisponibilidadController {
  constructor(
    @Inject(DisponibilidadService)
    private readonly service: DisponibilidadService,
  ) {}

  @Post('horarios')
  @Permissions('disponibilidad.crear')
  @ApiOperation({ summary: 'Registrar un horario semanal' })
  createSchedule(@Body() dto: CreateHorarioPersonalDto) {
    return this.service.createHorario(dto);
  }

  @Get('opciones')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Listar especialistas disponibles para configurar' })
  options() {
    return this.service.options();
  }

  @Get('horarios')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Listar horarios semanales' })
  @ApiOkResponse({
    schema: paginatedSchema(getSchemaPath(HorarioPersonal)),
  })
  findSchedules(@Query() query: HorarioPersonalQueryDto) {
    return this.service.findHorarios(query);
  }

  @Get('horarios/:id')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Consultar un horario semanal' })
  findSchedule(@Param('id', ParseIntPipe) id: number) {
    return this.service.findHorario(id);
  }

  @Patch('horarios/:id')
  @Permissions('disponibilidad.actualizar')
  @ApiOperation({ summary: 'Actualizar o desactivar un horario semanal' })
  updateSchedule(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHorarioPersonalDto,
  ) {
    return this.service.updateHorario(id, dto);
  }

  @Put('horarios/personal/:idPersonal')
  @Permissions('disponibilidad.actualizar')
  @ApiOperation({ summary: 'Reemplazar la semana habitual de un empleado' })
  replaceStaffWeek(
    @Param('idPersonal', ParseIntPipe) idPersonal: number,
    @Body() dto: ReplaceHorariosPersonalDto,
  ) {
    return this.service.replaceStaffWeek(idPersonal, dto);
  }

  @Post('horarios-extras')
  @Permissions('disponibilidad.crear')
  @ApiOperation({ summary: 'Autorizar un horario extra para una fecha' })
  createExtra(
    @Body() dto: CreateHorarioExtraDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createExtra(dto, user.sub);
  }

  @Get('horarios-extras')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Listar horarios extras' })
  @ApiOkResponse({
    schema: paginatedSchema(getSchemaPath(HorarioExtraPersonal)),
  })
  findExtras(@Query() query: HorarioExtraQueryDto) {
    return this.service.findExtras(query);
  }

  @Get('horarios-extras/:id')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Consultar un horario extra' })
  findExtra(@Param('id', ParseIntPipe) id: number) {
    return this.service.findExtra(id);
  }

  @Patch('horarios-extras/:id')
  @Permissions('disponibilidad.actualizar')
  @ApiOperation({ summary: 'Actualizar o cancelar un horario extra' })
  updateExtra(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHorarioExtraDto,
  ) {
    return this.service.updateExtra(id, dto);
  }

  @Post('permisos')
  @Permissions('disponibilidad.crear')
  @ApiOperation({ summary: 'Registrar un permiso del personal' })
  createPermission(@Body() dto: CreatePermisoPersonalDto) {
    return this.service.createPermission(dto);
  }

  @Get('permisos')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Listar permisos del personal' })
  @ApiOkResponse({
    schema: paginatedSchema(getSchemaPath(PermisoPersonal)),
  })
  findPermissions(@Query() query: PermisoPersonalQueryDto) {
    return this.service.findPermissions(query);
  }

  @Get('permisos/:id')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Consultar un permiso' })
  findPermission(@Param('id', ParseIntPipe) id: number) {
    return this.service.findPermission(id);
  }

  @Patch('permisos/:id')
  @Permissions('disponibilidad.actualizar')
  @ApiOperation({ summary: 'Actualizar un permiso' })
  updatePermission(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePermisoPersonalDto,
  ) {
    return this.service.updatePermission(id, dto);
  }

  @Delete('permisos/:id')
  @Permissions('disponibilidad.actualizar')
  @ApiOperation({ summary: 'Eliminar un permiso del personal' })
  removePermission(@Param('id', ParseIntPipe) id: number) {
    return this.service.removePermission(id);
  }
}
