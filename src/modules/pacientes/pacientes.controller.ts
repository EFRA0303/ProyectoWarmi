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
import { PacientesService } from './pacientes.service.js';
import { CreatePacienteDto } from './dto/create-paciente.dto.js';
import { UpdatePacienteDto } from './dto/update-paciente.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { BajaDto } from '../../common/dto/baja.dto.js';

@ApiBearerAuth('access-token')
@Controller('pacientes')
export class PacientesController {
  constructor(
    @Inject(PacientesService) private readonly service: PacientesService,
  ) {}

  @Post()
  @Permissions('pacientes.crear')
  @ApiOperation({
    summary: 'Registrar un paciente',
    description: 'Crea el registro de paciente asociado a una persona.',
  })
  create(@Body() dto: CreatePacienteDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
  @Get()
  @Permissions('pacientes.leer')
  @ApiOperation({ summary: 'Listar pacientes' })
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @Permissions('pacientes.leer')
  @ApiOperation({ summary: 'Consultar un paciente por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions('pacientes.actualizar')
  @ApiOperation({ summary: 'Actualizar los datos de un paciente' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePacienteDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
  @Patch(':id/baja')
  @Permissions('pacientes.actualizar')
  @ApiOperation({
    summary: 'Dar de baja o reactivar un paciente',
    description:
      'Cambia su estado y registra el motivo de baja cuando corresponde.',
  })
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deactivate(id, user.sub, dto.motivo_baja);
  }
}
