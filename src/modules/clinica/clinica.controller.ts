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
} from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { paginatedSchema } from '../../common/swagger/paginated-schema.js';
import { ClinicaService } from './clinica.service.js';
import {
  CreateAmpliacionDto,
  CreateSesionDto,
  CreateSolicitudDto,
  CreateTratamientoDto,
  CreateValoracionDto,
  RegistrarMedidaDto,
  UpdateSesionDto,
  UpdateSolicitudDto,
  UpdateTratamientoDto,
  UpdateValoracionDto,
} from './dto/clinica.dto.js';
import {
  Sesion,
  SolicitudServicio,
  TratamientoPaciente,
  Valoracion,
} from './entities/clinica.entities.js';
@ApiTags('Atencion clinica')
@ApiBearerAuth('access-token')
@ApiExtraModels(SolicitudServicio, TratamientoPaciente, Sesion, Valoracion)
@Controller('clinica')
export class ClinicaController {
  constructor(@Inject(ClinicaService) private readonly s: ClinicaService) {}
  @Post('solicitudes')
  @Permissions('clinica.crear')
  @ApiOperation({
    summary: 'Crear una solicitud de servicio',
    description:
      'Registra una solicitud clínica para un paciente dentro de un historial activo.',
  })
  createSolicitud(@Body() d: CreateSolicitudDto) {
    return this.s.createSolicitud(d);
  }
  @Get('solicitudes')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Listar solicitudes de servicio' })
  @ApiOkResponse({ schema: paginatedSchema(SolicitudServicio) })
  listSolicitudes(@Query() q: DomainQueryDto) {
    return this.s.listSolicitudes(q);
  }
  @Get('solicitudes/:id')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Consultar una solicitud por ID' })
  getSolicitud(@Param('id', ParseIntPipe) id: number) {
    return this.s.oneSolicitud(id);
  }
  @Patch('solicitudes/:id')
  @Permissions('clinica.actualizar')
  @ApiOperation({
    summary: 'Actualizar una solicitud de servicio',
    description:
      'Modifica los datos permitidos y controla las transiciones de estado de la solicitud.',
  })
  updateSolicitud(
    @Param('id', ParseIntPipe) id: number,
    @Body() x: UpdateSolicitudDto,
  ) {
    return this.s.updateSolicitud(id, x);
  }
  @Post('tratamientos')
  @Permissions('clinica.crear')
  @ApiOperation({
    summary: 'Crear un tratamiento para un paciente',
    description:
      'Registra el tratamiento y valida su servicio, número de sesiones y adquisición asociada.',
  })
  createTratamiento(@Body() d: CreateTratamientoDto) {
    return this.s.createTratamiento(d);
  }
  @Get('tratamientos')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Listar tratamientos de pacientes' })
  @ApiOkResponse({ schema: paginatedSchema(TratamientoPaciente) })
  listTratamientos(@Query() q: DomainQueryDto) {
    return this.s.listTratamientos(q);
  }
  @Get('tratamientos/:id')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Consultar un tratamiento por ID' })
  getTratamiento(@Param('id', ParseIntPipe) id: number) {
    return this.s.oneTratamiento(id);
  }
  @Patch('tratamientos/:id')
  @Permissions('clinica.actualizar')
  @ApiOperation({
    summary: 'Actualizar un tratamiento',
    description:
      'Actualiza los campos habilitados y aplica las reglas de cambio de estado del tratamiento.',
  })
  updateTratamiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateTratamientoDto,
  ) {
    return this.s.updateTratamiento(id, d);
  }
  @Post('tratamientos/:id/ampliaciones')
  @Permissions('clinica.actualizar')
  @ApiOperation({
    summary: 'Ampliar las sesiones de un tratamiento',
    description:
      'Añade sesiones autorizadas al tratamiento y conserva el registro de la ampliación.',
  })
  createAmpliacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: CreateAmpliacionDto,
  ) {
    return this.s.ampliar(id, d);
  }
  @Get('tratamientos/:id/ampliaciones')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Listar ampliaciones de un tratamiento' })
  listAmpliaciones(@Param('id', ParseIntPipe) id: number) {
    return this.s.ampliaciones(id);
  }
  @Post('sesiones')
  @Permissions('clinica.crear')
  @ApiOperation({
    summary: 'Registrar una sesión clínica',
    description:
      'Registra la atención, consume una sesión disponible del tratamiento y actualiza la cita relacionada cuando corresponde.',
  })
  createSesion(@Body() d: CreateSesionDto) {
    return this.s.createSesion(d);
  }
  @Get('sesiones')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Listar sesiones clínicas' })
  @ApiOkResponse({ schema: paginatedSchema(Sesion) })
  listSesiones(@Query() q: DomainQueryDto) {
    return this.s.listSesiones(q);
  }
  @Get('sesiones/:id')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Consultar una sesión por ID' })
  getSesion(@Param('id', ParseIntPipe) id: number) {
    return this.s.oneSesion(id);
  }
  @Patch('sesiones/:id')
  @Permissions('clinica.actualizar')
  @ApiOperation({ summary: 'Actualizar las observaciones de una sesión' })
  updateSesion(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateSesionDto,
  ) {
    return this.s.updateSesion(id, d);
  }
  @Post('valoraciones')
  @Permissions('clinica.crear')
  @ApiOperation({
    summary: 'Crear una valoración clínica',
    description:
      'Registra una valoración vinculada al origen clínico correspondiente del paciente.',
  })
  createValoracion(@Body() d: CreateValoracionDto) {
    return this.s.createValoracion(d);
  }
  @Get('valoraciones')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Listar valoraciones clínicas' })
  @ApiOkResponse({ schema: paginatedSchema(Valoracion) })
  listValoraciones(@Query() q: DomainQueryDto) {
    return this.s.listValoraciones(q);
  }
  @Get('valoraciones/:id')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Consultar una valoración por ID' })
  getValoracion(@Param('id', ParseIntPipe) id: number) {
    return this.s.oneValoracion(id);
  }
  @Patch('valoraciones/:id')
  @Permissions('clinica.actualizar')
  @ApiOperation({ summary: 'Actualizar una valoración clínica' })
  updateValoracion(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateValoracionDto,
  ) {
    return this.s.updateValoracion(id, d);
  }
  @Post('valoraciones/:id/medidas')
  @Permissions('clinica.actualizar')
  @ApiOperation({
    summary: 'Registrar o actualizar una medida corporal',
    description:
      'Guarda el valor de una medida configurada para la valoración indicada.',
  })
  setMedida(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: RegistrarMedidaDto,
  ) {
    return this.s.setMedida(id, d);
  }
  @Get('valoraciones/:id/medidas')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Listar medidas de una valoración' })
  listMedidas(@Param('id', ParseIntPipe) id: number) {
    return this.s.medidas(id);
  }
}
