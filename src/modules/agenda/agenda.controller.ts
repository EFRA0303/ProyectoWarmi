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
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { paginatedSchema } from '../../common/swagger/paginated-schema.js';
import { AgendaService } from './agenda.service.js';
import {
  CreateCitaDto,
  CreateNotificacionCitaDto,
  ReprogramarCitaDto,
  UpdateCitaDto,
  UpdateNotificacionCitaDto,
} from './dto/agenda.dto.js';
import { Cita, NotificacionCita } from './entities/agenda.entities.js';
@ApiTags('Agenda y citas')
@ApiBearerAuth('access-token')
@ApiExtraModels(Cita, NotificacionCita)
@Controller('agenda')
export class AgendaController {
  constructor(@Inject(AgendaService) private readonly service: AgendaService) {}
  @Post('citas') @Permissions('agenda.crear') create(@Body() d: CreateCitaDto) {
    return this.service.create(d);
  }
  @Get('citas')
  @Permissions('agenda.leer')
  @ApiOkResponse({ schema: paginatedSchema(Cita) })
  list(@Query() q: DomainQueryDto) {
    return this.service.list(q);
  }
  @Get('citas/:id') @Permissions('agenda.leer') one(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.one(id);
  }
  @Patch('citas/:id') @Permissions('agenda.actualizar') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateCitaDto,
  ) {
    return this.service.update(id, d);
  }
  @Post('citas/:id/reprogramaciones')
  @Permissions('agenda.actualizar')
  reprogram(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: ReprogramarCitaDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.service.reprogram(id, d, u.sub);
  }
  @Get('citas/:id/reprogramaciones') @Permissions('agenda.leer') history(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.history(id);
  }
  @Post('notificaciones') @Permissions('agenda.crear') createNotification(
    @Body() d: CreateNotificacionCitaDto,
  ) {
    return this.service.createNotification(d);
  }
  @Get('notificaciones')
  @Permissions('agenda.leer')
  @ApiOkResponse({ schema: paginatedSchema(NotificacionCita) })
  listNotifications(@Query() q: DomainQueryDto) {
    return this.service.listNotifications(q);
  }
  @Get('notificaciones/:id') @Permissions('agenda.leer') oneNotification(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.oneNotification(id);
  }
  @Patch('notificaciones/:id')
  @Permissions('agenda.actualizar')
  updateNotification(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateNotificacionCitaDto,
  ) {
    return this.service.updateNotification(id, d);
  }
}
