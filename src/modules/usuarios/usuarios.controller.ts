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
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { UsuariosService } from './usuarios.service.js';
import { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { UpdateUsuarioDto } from './dto/update-usuario.dto.js';
import { UsuarioQueryDto } from './dto/usuario-query.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { BajaDto } from '../../common/dto/baja.dto.js';
import { requestMetadata } from '../../common/interfaces/request-metadata.interface.js';
import { DisponibilidadUsuarioDto } from './dto/disponibilidad-usuario.dto.js';
import { CambiarEstadoUsuarioDto } from './dto/cambiar-estado-usuario.dto.js';

@ApiBearerAuth('access-token')
@Controller('usuarios')
export class UsuariosController {
  constructor(
    @Inject(UsuariosService) private readonly service: UsuariosService,
  ) {}

  @Post()
  @Permissions('usuarios.crear', 'roles.asignar')
  @ApiOperation({ summary: 'Crear un usuario y asignarle un rol' })
  create(@Body() dto: CreateUsuarioDto, @CurrentUser() user: JwtPayload) {
    return this.service.register(dto, user.sub);
  }
  @Get()
  @Permissions('usuarios.leer')
  @ApiOperation({
    summary: 'Listar usuarios',
    description:
      'Devuelve usuarios paginados con su persona, rol, creador y vínculos de paciente o personal. Permite buscar por datos personales o de acceso y filtrar por estado y tipo.',
  })
  findAll(@Query() query: UsuarioQueryDto) {
    return this.service.findAllWithDetails(query);
  }
  @Get('disponibilidad')
  @Permissions('usuarios.crear')
  @ApiOperation({
    summary: 'Verificar disponibilidad de correo y nombre de usuario',
  })
  availability(@Query() query: DisponibilidadUsuarioDto) {
    return this.service.availability(query.correo_acceso, query.nombre_usuario);
  }
  @Get(':id')
  @Permissions('usuarios.leer')
  @ApiOperation({
    summary: 'Consultar un usuario por ID',
    description:
      'Devuelve el usuario con su persona, rol y los datos personales de quien creó la cuenta.',
  })
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOneWithDetails(id);
  }
  @Patch(':id')
  @Permissions('usuarios.actualizar')
  @ApiOperation({ summary: 'Actualizar los datos de un usuario' })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateUsuarioDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    if (dto.correo_acceso) dto.correo_acceso = dto.correo_acceso.toLowerCase();
    return this.service.updateWithAudit(
      id,
      dto,
      user.sub,
      requestMetadata(request),
    );
  }
  @Patch(':id/estado')
  @Permissions('usuarios.actualizar')
  @ApiOperation({
    summary: 'Cambiar el estado de acceso de un usuario',
    description:
      'Permite reactivar, bloquear temporalmente con fecha y motivo, o dar de baja con motivo. Los bloqueos temporales reutilizan bloqueado_hasta.',
  })
  changeAccessState(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CambiarEstadoUsuarioDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    return this.service.changeAccessStateWithAudit(
      id,
      dto,
      user.sub,
      requestMetadata(request),
    );
  }
  @Patch(':id/baja')
  @Permissions('usuarios.actualizar')
  @ApiOperation({
    summary: 'Dar de baja un usuario',
    description:
      'Cambia el estado de acceso del usuario a BAJA y registra el motivo en auditoría.',
  })
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaDto,
    @CurrentUser() user: JwtPayload,
    @Req() request: Request,
  ) {
    return this.service.deactivateWithAudit(
      id,
      user.sub,
      requestMetadata(request),
      dto.motivo_baja,
    );
  }
}
