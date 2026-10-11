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
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { paginatedSchema } from '../../common/swagger/paginated-schema.js';
import { AgendaService } from './agenda.service.js';
import {
  CreateCitaDto,
  CreateNotificacionCitaDto,
  AgendaQueryDto,
  ReprogramarCitaDto,
  UpdateCitaDto,
  UpdateNotificacionCitaDto,
  NotificationQueryDto,
} from './dto/agenda.dto.js';
import { Cita, NotificacionCita } from './entities/agenda.entities.js';
@ApiTags('Agenda y citas')
@ApiBearerAuth('access-token')
@ApiExtraModels(Cita, NotificacionCita)
@Controller('agenda')
export class AgendaController {
  constructor(@Inject(AgendaService) private readonly service: AgendaService) {}
  @Post('citas')
  @Permissions('agenda.crear')
  @ApiOperation({
    summary: 'Programar una cita',
    description:
      'Valida la disponibilidad del personal, bloqueos, cruces de horario y duración del servicio antes de crear la cita.',
  })
  create(@Body() d: CreateCitaDto) {
    return this.service.create(d);
  }
  @Get('citas')
  @Permissions('agenda.leer')
  @ApiOperation({ summary: 'Listar citas con filtros' })
  @ApiOkResponse({ schema: paginatedSchema(Cita) })
  list(@Query() q: AgendaQueryDto) {
    return this.service.list(q);
  }
  @Get('opciones')
  @Permissions('agenda.leer')
  @ApiOperation({ summary: 'Consultar pacientes, personal y tratamientos disponibles' })
  options() {
    return this.service.options();
  }
  @Get('citas/:id')
  @Permissions('agenda.leer')
  @ApiOperation({ summary: 'Consultar una cita por ID' })
  one(@Param('id', ParseIntPipe) id: number) {
    return this.service.one(id);
  }
  @Patch('citas/:id')
  @Permissions('agenda.actualizar')
  @ApiOperation({
    summary: 'Actualizar una cita',
    description:
      'Modifica los datos permitidos o el estado de la cita aplicando las reglas de agenda.',
  })
  update(@Param('id', ParseIntPipe) id: number, @Body() d: UpdateCitaDto) {
    return this.service.update(id, d);
  }
  @Post('citas/:id/reprogramaciones')
  @Permissions('agenda.actualizar')
  @ApiOperation({
    summary: 'Reprogramar una cita',
    description:
      'Valida el nuevo horario y registra el cambio en el historial de reprogramaciones.',
  })
  reprogram(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: ReprogramarCitaDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.service.reprogram(id, d, u.sub);
  }
  @Get('citas/:id/reprogramaciones')
  @Permissions('agenda.leer')
  @ApiOperation({ summary: 'Consultar reprogramaciones de una cita' })
  history(@Param('id', ParseIntPipe) id: number) {
    return this.service.history(id);
  }
  @Post('notificaciones')
  @Permissions('agenda.crear')
  @ApiOperation({ summary: 'Programar una notificación de cita' })
  createNotification(@Body() d: CreateNotificacionCitaDto) {
    return this.service.createNotification(d);
  }
  @Get('notificaciones')
  @Permissions('agenda.leer')
  @ApiOperation({ summary: 'Listar notificaciones de citas' })
  @ApiOkResponse({ schema: paginatedSchema(NotificacionCita) })
  listNotifications(@Query() q: NotificationQueryDto) {
    return this.service.listNotifications(q);
  }
  @Get('notificaciones-opciones/listar')
  @Permissions('agenda.leer')
  @ApiOperation({ summary: 'Listar citas disponibles para notificaciones' })
  notificationOptions() {
    return this.service.notificationOptions();
  }
  @Get('notificaciones/:id')
  @Permissions('agenda.leer')
  @ApiOperation({ summary: 'Consultar una notificación por ID' })
  oneNotification(@Param('id', ParseIntPipe) id: number) {
    return this.service.oneNotification(id);
  }
  @Patch('notificaciones/:id')
  @Permissions('agenda.actualizar')
  @ApiOperation({
    summary: 'Actualizar el estado de una notificación',
    description:
      'Permite registrar el resultado del envío o modificar sus datos habilitados.',
  })
  updateNotification(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateNotificacionCitaDto,
  ) {
    return this.service.updateNotification(id, d);
  }
}
