import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AccesosUsuarioService } from './accesos-usuario.service.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { AccessQueryDto } from './dto/access-query.dto.js';

@ApiTags('Accesos de usuarios')
@ApiBearerAuth('access-token')
@Controller('accesos-usuario')
export class AccesosUsuarioController {
  constructor(
    @Inject(AccesosUsuarioService)
    private readonly service: AccesosUsuarioService,
  ) {}

  @Get()
  @Permissions('accesos-usuario.leer')
  @ApiOperation({ summary: 'Consultar el historial general de accesos' })
  findAll(@Query() query: AccessQueryDto) {
    return this.service.findAll(query);
  }

  @Get('exitosos')
  @Permissions('accesos-usuario.leer')
  @ApiOperation({ summary: 'Consultar accesos exitosos' })
  findSuccessful(@Query() query: AccessQueryDto) {
    return this.service.findSuccessful(query);
  }

  @Get('fallidos')
  @Permissions('accesos-usuario.leer')
  @ApiOperation({ summary: 'Consultar accesos fallidos' })
  findFailed(@Query() query: AccessQueryDto) {
    return this.service.findFailed(query);
  }

  @Get('ultimos')
  @Permissions('accesos-usuario.leer')
  @ApiOperation({
    summary: 'Consultar el ultimo acceso exitoso de cada usuario',
  })
  findLatestByUser() {
    return this.service.findLatestByUser();
  }

  @Get('usuario/:idUsuario')
  @Permissions('accesos-usuario.leer')
  @ApiOperation({ summary: 'Consultar el historial de un usuario' })
  findByUser(
    @Param('idUsuario', ParseIntPipe) userId: number,
    @Query() query: AccessQueryDto,
  ) {
    return this.service.findByUser(userId, query);
  }

  @Get(':id')
  @Permissions('accesos-usuario.leer')
  findOne(@Param('id') id: string) {
    this.validateBigintId(id);
    return this.service.findOne(id);
  }

  @Delete()
  @Permissions('accesos-usuario.eliminar')
  @ApiOperation({ summary: 'Eliminar todo el historial de accesos' })
  deleteAll() {
    return this.service.deleteAll();
  }

  @Delete('usuario/:idUsuario')
  @Permissions('accesos-usuario.eliminar')
  @ApiOperation({ summary: 'Eliminar el historial de un usuario' })
  deleteByUser(@Param('idUsuario', ParseIntPipe) userId: number) {
    return this.service.deleteByUser(userId);
  }

  private validateBigintId(id: string) {
    if (
      !/^[1-9][0-9]*$/.test(id) ||
      id.length > 19 ||
      BigInt(id) > 9223372036854775807n
    )
      throw new BadRequestException('ID invalido');
  }
}
