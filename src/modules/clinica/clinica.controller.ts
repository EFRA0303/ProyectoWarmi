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
  RegistrarMedidasDto,
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
  @Get('solicitudes-opciones')
  @Permissions('clinica.leer')
  @ApiOperation({ summary: 'Listar pacientes y servicios para solicitudes' })
  opcionesSolicitudes() {
    return this.s.opcionesSolicitudes();
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
  @Permissions('tratamientos.crear')
  @ApiOperation({
    summary: 'Crear un tratamiento para un paciente',
    description:
      'Registra el tratamiento y valida su servicio, número de sesiones y adquisición asociada.',
  })
  createTratamiento(@Body() d: CreateTratamientoDto) {
    return this.s.createTratamiento(d);
  }
  @Get('tratamientos')
  @Permissions('tratamientos.leer')
  @ApiOperation({ summary: 'Listar tratamientos de pacientes' })
  @ApiOkResponse({ schema: paginatedSchema(TratamientoPaciente) })
  listTratamientos(@Query() q: DomainQueryDto) {
    return this.s.listTratamientos(q);
  }
  @Get('tratamientos-opciones')
  @Permissions('tratamientos.leer')
  @ApiOperation({ summary: 'Listar opciones para gestionar tratamientos' })
  opcionesTratamientos() {
    return this.s.opcionesTratamientos();
  }
  @Get('tratamientos/:id')
  @Permissions('tratamientos.leer')
  @ApiOperation({ summary: 'Consultar un tratamiento por ID' })
  getTratamiento(@Param('id', ParseIntPipe) id: number) {
    return this.s.oneTratamiento(id);
  }
  @Patch('tratamientos/:id')
  @Permissions('tratamientos.actualizar')
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
  @Permissions('tratamientos.actualizar')
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
  @Permissions('tratamientos.leer')
  @ApiOperation({ summary: 'Listar ampliaciones de un tratamiento' })
  listAmpliaciones(@Param('id', ParseIntPipe) id: number) {
    return this.s.ampliaciones(id);
  }
  @Patch('tratamientos/:id/cancelar')
  @Permissions('tratamientos.cancelar')
  @ApiOperation({ summary: 'Cancelar un tratamiento de forma lógica' })
  cancelarTratamiento(@Param('id', ParseIntPipe) id: number) {
    return this.s.cancelarTratamiento(id);
  }
  @Post('sesiones')
  @Permissions('clinica.crear')
  @ApiOperation({
    summary: 'Iniciar una sesión clínica',
    description:
      'Inicia la atención en estado EN_CURSO. La sesión se contabiliza y la cita se marca como atendida solamente al finalizarla.',
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
  @Get('sesiones-opciones')
  @Permissions('clinica.leer')
  @ApiOperation({
    summary: 'Listar citas, tratamientos y personal para sesiones',
  })
  opcionesSesiones() {
    return this.s.opcionesSesiones();
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
  @Patch('sesiones/:id/finalizar')
  @Permissions('clinica.actualizar')
  @ApiOperation({ summary: 'Finalizar una sesión clínica en curso' })
  finalizarSesion(@Param('id', ParseIntPipe) id: number) {
    return this.s.finalizarSesion(id);
  }
  @Patch('sesiones/:id/cancelar')
  @Permissions('clinica.actualizar')
  @ApiOperation({ summary: 'Cancelar lógicamente una sesión clínica en curso' })
  cancelarSesion(@Param('id', ParseIntPipe) id: number) {
    return this.s.cancelarSesion(id);
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
  @Get('valoraciones-opciones')
  @Permissions('clinica.leer')
  @ApiOperation({
    summary: 'Listar pacientes, orígenes, personal y medidas para valoraciones',
  })
  opcionesValoraciones() {
    return this.s.opcionesValoraciones();
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
  @Put('valoraciones/:id/medidas')
  @Permissions('clinica.actualizar')
  @ApiOperation({
    summary: 'Registrar o actualizar varias medidas de una valoración',
  })
  setMedidas(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: RegistrarMedidasDto,
  ) {
    return this.s.setMedidas(id, d.medidas);
  }
}
