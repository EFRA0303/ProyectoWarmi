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
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { CreateBloqueoPersonalDto } from './dto/create-bloqueo-personal.dto.js';
import { CreateHorarioExtraDto } from './dto/create-horario-extra.dto.js';
import { CreateHorarioPersonalDto } from './dto/create-horario-personal.dto.js';
import {
  BloqueoPersonalQueryDto,
  HorarioExtraQueryDto,
  HorarioPersonalQueryDto,
} from './dto/disponibilidad-query.dto.js';
import { UpdateBloqueoPersonalDto } from './dto/update-bloqueo-personal.dto.js';
import { UpdateHorarioExtraDto } from './dto/update-horario-extra.dto.js';
import { UpdateHorarioPersonalDto } from './dto/update-horario-personal.dto.js';
import { DisponibilidadService } from './disponibilidad.service.js';
import { BloqueoPersonal } from './entities/bloqueo-personal.entity.js';
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
@ApiExtraModels(HorarioPersonal, HorarioExtraPersonal, BloqueoPersonal)
@Controller('disponibilidad')
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

  @Post('horarios-extra')
  @Permissions('disponibilidad.crear')
  @ApiOperation({ summary: 'Autorizar un horario adicional para una fecha' })
  createExtra(
    @Body() dto: CreateHorarioExtraDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.createExtra(dto, user.sub);
  }

  @Get('horarios-extra')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Listar horarios adicionales' })
  @ApiOkResponse({
    schema: paginatedSchema(getSchemaPath(HorarioExtraPersonal)),
  })
  findExtras(@Query() query: HorarioExtraQueryDto) {
    return this.service.findExtras(query);
  }

  @Get('horarios-extra/:id')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Consultar un horario adicional' })
  findExtra(@Param('id', ParseIntPipe) id: number) {
    return this.service.findExtra(id);
  }

  @Patch('horarios-extra/:id')
  @Permissions('disponibilidad.actualizar')
  @ApiOperation({ summary: 'Actualizar o cancelar un horario adicional' })
  updateExtra(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHorarioExtraDto,
  ) {
    return this.service.updateExtra(id, dto);
  }

  @Post('bloqueos')
  @Permissions('disponibilidad.crear')
  @ApiOperation({ summary: 'Registrar un bloqueo de disponibilidad' })
  createBlock(@Body() dto: CreateBloqueoPersonalDto) {
    return this.service.createBlock(dto);
  }

  @Get('bloqueos')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Listar bloqueos de disponibilidad' })
  @ApiOkResponse({
    schema: paginatedSchema(getSchemaPath(BloqueoPersonal)),
  })
  findBlocks(@Query() query: BloqueoPersonalQueryDto) {
    return this.service.findBlocks(query);
  }

  @Get('bloqueos/:id')
  @Permissions('disponibilidad.leer')
  @ApiOperation({ summary: 'Consultar un bloqueo' })
  findBlock(@Param('id', ParseIntPipe) id: number) {
    return this.service.findBlock(id);
  }

  @Patch('bloqueos/:id')
  @Permissions('disponibilidad.actualizar')
  @ApiOperation({ summary: 'Actualizar un bloqueo' })
  updateBlock(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBloqueoPersonalDto,
  ) {
    return this.service.updateBlock(id, dto);
  }
}
