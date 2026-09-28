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
  @Post('solicitudes') @Permissions('clinica.crear') createSolicitud(
    @Body() d: CreateSolicitudDto,
  ) {
    return this.s.createSolicitud(d);
  }
  @Get('solicitudes')
  @Permissions('clinica.leer')
  @ApiOkResponse({ schema: paginatedSchema(SolicitudServicio) })
  listSolicitudes(@Query() q: DomainQueryDto) {
    return this.s.listSolicitudes(q);
  }
  @Get('solicitudes/:id') @Permissions('clinica.leer') getSolicitud(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.oneSolicitud(id);
  }
  @Patch('solicitudes/:id') @Permissions('clinica.actualizar') updateSolicitud(
    @Param('id', ParseIntPipe) id: number,
    @Body() x: UpdateSolicitudDto,
  ) {
    return this.s.updateSolicitud(id, x);
  }
  @Post('tratamientos') @Permissions('clinica.crear') createTratamiento(
    @Body() d: CreateTratamientoDto,
  ) {
    return this.s.createTratamiento(d);
  }
  @Get('tratamientos')
  @Permissions('clinica.leer')
  @ApiOkResponse({ schema: paginatedSchema(TratamientoPaciente) })
  listTratamientos(@Query() q: DomainQueryDto) {
    return this.s.listTratamientos(q);
  }
  @Get('tratamientos/:id') @Permissions('clinica.leer') getTratamiento(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.oneTratamiento(id);
  }
  @Patch('tratamientos/:id')
  @Permissions('clinica.actualizar')
  updateTratamiento(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateTratamientoDto,
  ) {
    return this.s.updateTratamiento(id, d);
  }
  @Post('tratamientos/:id/ampliaciones')
  @Permissions('clinica.actualizar')
  createAmpliacion(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: CreateAmpliacionDto,
  ) {
    return this.s.ampliar(id, d);
  }
  @Get('tratamientos/:id/ampliaciones')
  @Permissions('clinica.leer')
  listAmpliaciones(@Param('id', ParseIntPipe) id: number) {
    return this.s.ampliaciones(id);
  }
  @Post('sesiones') @Permissions('clinica.crear') createSesion(
    @Body() d: CreateSesionDto,
  ) {
    return this.s.createSesion(d);
  }
  @Get('sesiones')
  @Permissions('clinica.leer')
  @ApiOkResponse({ schema: paginatedSchema(Sesion) })
  listSesiones(@Query() q: DomainQueryDto) {
    return this.s.listSesiones(q);
  }
  @Get('sesiones/:id') @Permissions('clinica.leer') getSesion(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.oneSesion(id);
  }
  @Patch('sesiones/:id') @Permissions('clinica.actualizar') updateSesion(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateSesionDto,
  ) {
    return this.s.updateSesion(id, d);
  }
  @Post('valoraciones') @Permissions('clinica.crear') createValoracion(
    @Body() d: CreateValoracionDto,
  ) {
    return this.s.createValoracion(d);
  }
  @Get('valoraciones')
  @Permissions('clinica.leer')
  @ApiOkResponse({ schema: paginatedSchema(Valoracion) })
  listValoraciones(@Query() q: DomainQueryDto) {
    return this.s.listValoraciones(q);
  }
  @Get('valoraciones/:id') @Permissions('clinica.leer') getValoracion(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.oneValoracion(id);
  }
  @Patch('valoraciones/:id')
  @Permissions('clinica.actualizar')
  updateValoracion(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateValoracionDto,
  ) {
    return this.s.updateValoracion(id, d);
  }
  @Post('valoraciones/:id/medidas')
  @Permissions('clinica.actualizar')
  setMedida(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: RegistrarMedidaDto,
  ) {
    return this.s.setMedida(id, d);
  }
  @Get('valoraciones/:id/medidas') @Permissions('clinica.leer') listMedidas(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.medidas(id);
  }
}
