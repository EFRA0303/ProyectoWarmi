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
import { PersonalService } from './personal.service.js';
import { CreatePersonalDto } from './dto/create-personal.dto.js';
import { UpdatePersonalDto } from './dto/update-personal.dto.js';
import { PersonalQueryDto } from './dto/personal-query.dto.js';
import { RegistroCompletoPersonalDto } from './dto/registro-completo-personal.dto.js';
import { ActualizacionCompletaPersonalDto } from './dto/actualizacion-completa-personal.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { BajaDto } from '../../common/dto/baja.dto.js';

@ApiBearerAuth('access-token')
@Controller('personal')
export class PersonalController {
  constructor(
    @Inject(PersonalService) private readonly service: PersonalService,
  ) {}

  @Post()
  @Permissions('personal.crear')
  @ApiOperation({
    summary: 'Registrar un miembro del personal',
    description: 'Crea el registro laboral asociado a una persona.',
  })
  create(@Body() dto: CreatePersonalDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
  @Post('registro-completo')
  @Permissions(
    'personas.crear',
    'usuarios.crear',
    'roles.asignar',
    'personal.crear',
  )
  @ApiOperation({
    summary: 'Registrar una persona, su cuenta y datos laborales',
    description:
      'Crea Persona, Usuario y Personal de forma atómica, valida el rol y cifra la contraseña.',
  })
  registerComplete(
    @Body() dto: RegistroCompletoPersonalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.registerComplete(dto, user.sub);
  }
  @Patch(':id/actualizacion-completa')
  @Permissions(
    'personas.actualizar',
    'usuarios.actualizar',
    'personal.actualizar',
  )
  @ApiOperation({
    summary: 'Actualizar persona, cuenta y datos laborales',
    description:
      'Actualiza los datos editables del empleado en una sola transacción.',
  })
  updateComplete(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ActualizacionCompletaPersonalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.updateComplete(id, dto, user.sub);
  }
  @Get()
  @Permissions('personal.leer')
  @ApiOperation({
    summary: 'Listar personal',
    description:
      'Devuelve datos laborales paginados con usuario, persona y rol; permite búsqueda y filtro por estado.',
  })
  findAll(@Query() query: PersonalQueryDto) {
    return this.service.findAllWithDetails(query);
  }
  @Get(':id')
  @Permissions('personal.leer')
  @ApiOperation({ summary: 'Consultar un miembro del personal por ID' })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions('personal.actualizar')
  @ApiOperation({ summary: 'Actualizar los datos del personal' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
  @Patch(':id/baja')
  @Permissions('personal.actualizar')
  @ApiOperation({
    summary: 'Dar de baja o reactivar al personal',
    description:
      'Cambia su estado y registra el motivo cuando se efectúa la baja.',
  })
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deactivate(id, user.sub, dto.motivo_baja);
  }
}
