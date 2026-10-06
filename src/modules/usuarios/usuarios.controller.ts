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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Post('paciente')
  @Permissions('usuarios.crear', 'roles.asignar', 'pacientes.leer')
  @ApiOperation({ summary: 'Crear una cuenta de acceso para un paciente' })
  createPatientAccount(
    @Body() dto: CreateUsuarioDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.registerPatientAccount(dto, user.sub);
  }
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
  @Get('presencia')
  @Permissions('usuarios.leer')
  @ApiOperation({
    summary: 'Consultar la presencia de usuarios',
    description:
      'Devuelve únicamente el estado en línea y la última actividad de los usuarios solicitados.',
  })
  presence(@Query('ids') ids?: string) {
    return this.service.findPresence(ids);
  }
  @Get('disponibilidad')
  @Permissions('usuarios.crear')
  @ApiOperation({
    summary: 'Verificar disponibilidad de correo y nombre de usuario',
  })
  availability(@Query() query: DisponibilidadUsuarioDto) {
    return this.service.availability(query.correo_acceso, query.nombre_usuario);
  }
  @Post(':id/foto-perfil')
  @Permissions('usuarios.actualizar')
  @UseInterceptors(FileInterceptor('foto', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Guardar la foto de perfil de un usuario' })
  uploadProfilePhoto(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
    @CurrentUser() user: JwtPayload,
  ) {
    if (!file) return this.service.saveProfilePhoto(id, { buffer: Buffer.alloc(0), size: 0 }, user.sub);
    return this.service.saveProfilePhoto(id, file, user.sub);
  }
  @Get(':id/foto-perfil')
  @ApiOperation({ summary: 'Obtener la foto de perfil de un usuario' })
  async profilePhoto(@Param('id', ParseIntPipe) id: number) {
    const photo = await this.service.getProfilePhoto(id);
    return new StreamableFile(photo.data, {
      type: photo.mime,
      length: photo.data.length,
      disposition: 'inline',
    });
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
