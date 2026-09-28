import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import type {
  CreateCitaDto,
  CreateNotificacionCitaDto,
  ReprogramarCitaDto,
  UpdateCitaDto,
  UpdateNotificacionCitaDto,
} from './dto/agenda.dto.js';
import {
  Cita,
  NotificacionCita,
  ReprogramacionCita,
} from './entities/agenda.entities.js';
import { EstadoCita } from '../../common/enums/domain.enums.js';
@Injectable()
export class AgendaService {
  private readonly citas: DomainResourceService<Cita>;
  private readonly notifications: DomainResourceService<NotificacionCita>;
  constructor(@Inject(DataSource) private readonly db: DataSource) {
    this.citas = new DomainResourceService(
      Cita,
      'id_cita',
      db.getRepository(Cita),
      'Cita',
    );
    this.notifications = new DomainResourceService(
      NotificacionCita,
      'id_notificacion',
      db.getRepository(NotificacionCita),
      'Notificacion',
    );
  }
  async create(dto: CreateCitaDto) {
    this.dates(dto.fecha_hora_inicio, dto.fecha_hora_fin);
    return this.db.transaction(async (manager) => {
      const start = new Date(dto.fecha_hora_inicio);
      const end = new Date(dto.fecha_hora_fin);
      await this.ensureAvailability(
        manager,
        dto.id_paciente,
        dto.id_personal,
        dto.id_tratamiento,
        start,
        end,
      );
      return this.citas.create(
        Object.assign({}, this.mapCita(dto), {
          estado: EstadoCita.PROGRAMADA,
        }),
        manager,
      );
    });
  }
  list(q: DomainQueryDto) {
    return this.citas.list(q);
  }
  one(id: number) {
    return this.citas.one(id);
  }
  async update(id: number, dto: UpdateCitaDto) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(Cita);
      const current = await repository.findOne({
        where: { id_cita: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) return this.citas.one(id, manager);
      const start = dto.fecha_hora_inicio
        ? new Date(dto.fecha_hora_inicio)
        : current.fecha_hora_inicio;
      const end = dto.fecha_hora_fin
        ? new Date(dto.fecha_hora_fin)
        : current.fecha_hora_fin;
      this.dates(start, end);
      if (dto.estado) this.ensureStateTransition(current.estado, dto.estado);
      if (
        dto.fecha_hora_inicio ||
        dto.fecha_hora_fin ||
        dto.id_personal ||
        dto.id_paciente ||
        dto.id_tratamiento
      )
        await this.ensureAvailability(
          manager,
          dto.id_paciente ?? current.id_paciente,
          dto.id_personal ?? current.id_personal,
          dto.id_tratamiento ?? current.id_tratamiento ?? undefined,
          start,
          end,
          id,
        );
      return repository.save(repository.merge(current, this.mapCita(dto)));
    });
  }
  async reprogram(id: number, dto: ReprogramarCitaDto, actor: number) {
    this.dates(dto.inicio_nuevo, dto.fin_nuevo);
    return this.db.transaction(async (manager) => {
      const repo = manager.getRepository(Cita);
      const cita = await repo.findOne({
        where: { id_cita: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!cita) return this.citas.one(id, manager);
      if (cita.estado !== EstadoCita.PROGRAMADA)
        throw new BadRequestException(
          'Solo se pueden reprogramar citas en estado PROGRAMADA',
        );
      await this.ensureAvailability(
        manager,
        cita.id_paciente,
        cita.id_personal,
        cita.id_tratamiento ?? undefined,
        new Date(dto.inicio_nuevo),
        new Date(dto.fin_nuevo),
        id,
      );
      const history = manager.getRepository(ReprogramacionCita).create({
        id_cita: id,
        inicio_anterior: cita.fecha_hora_inicio,
        fin_anterior: cita.fecha_hora_fin,
        inicio_nuevo: new Date(dto.inicio_nuevo),
        fin_nuevo: new Date(dto.fin_nuevo),
        realizado_por: actor,
        motivo: dto.motivo,
        solicitado_por_tipo: dto.solicitado_por_tipo,
      });
      await manager.getRepository(ReprogramacionCita).save(history);
      cita.fecha_hora_inicio = new Date(dto.inicio_nuevo);
      cita.fecha_hora_fin = new Date(dto.fin_nuevo);
      return repo.save(cita);
    });
  }
  async history(id: number) {
    await this.citas.one(id);
    return this.db
      .getRepository(ReprogramacionCita)
      .find({ where: { id_cita: id }, order: { registrado_en: 'DESC' } });
  }
  createNotification(dto: CreateNotificacionCitaDto) {
    return this.notifications.create(this.mapNotification(dto));
  }
  listNotifications(q: DomainQueryDto) {
    return this.notifications.list(q);
  }
  oneNotification(id: number) {
    return this.notifications.one(id);
  }
  updateNotification(id: number, dto: UpdateNotificacionCitaDto) {
    return this.notifications.update(id, this.mapNotification(dto));
  }
  private dates(start: string | Date, end: string | Date) {
    if (new Date(start) >= new Date(end))
      throw new BadRequestException(
        'La fecha de inicio debe ser anterior a la fecha de fin',
      );
  }
  private mapCita(dto: CreateCitaDto | UpdateCitaDto) {
    return Object.assign({}, dto, {
      ...(dto.fecha_hora_inicio
        ? { fecha_hora_inicio: new Date(dto.fecha_hora_inicio) }
        : {}),
      ...(dto.fecha_hora_fin
        ? { fecha_hora_fin: new Date(dto.fecha_hora_fin) }
        : {}),
      ...(dto.fecha_llegada
        ? { fecha_llegada: new Date(dto.fecha_llegada) }
        : {}),
    });
  }
  private mapNotification(
    dto: CreateNotificacionCitaDto | UpdateNotificacionCitaDto,
  ) {
    return Object.assign({}, dto, {
      ...(dto.programada_para
        ? { programada_para: new Date(dto.programada_para) }
        : {}),
      ...(dto.enviada_en ? { enviada_en: new Date(dto.enviada_en) } : {}),
    });
  }
  private ensureStateTransition(current: EstadoCita, next: EstadoCita) {
    if (current === next) return;
    const transitions: Record<EstadoCita, EstadoCita[]> = {
      [EstadoCita.PROGRAMADA]: [
        EstadoCita.EN_ESPERA,
        EstadoCita.CANCELADA,
        EstadoCita.NO_ASISTIO,
      ],
      [EstadoCita.EN_ESPERA]: [
        EstadoCita.ATENDIDA,
        EstadoCita.CANCELADA,
        EstadoCita.NO_ASISTIO,
      ],
      [EstadoCita.ATENDIDA]: [],
      [EstadoCita.CANCELADA]: [],
      [EstadoCita.NO_ASISTIO]: [],
    };
    if (!transitions[current].includes(next))
      throw new BadRequestException(
        `No se permite cambiar una cita de ${current} a ${next}`,
      );
  }
  private async ensureAvailability(
    manager: EntityManager,
    patientId: number,
    staffId: number,
    treatmentId: number | undefined,
    start: Date,
    end: Date,
    excludeId?: number,
  ) {
    const [patient] = (await manager.query(
      `SELECT 1 FROM pacientes WHERE id_paciente = $1 AND estado = 'ACTIVO'`,
      [patientId],
    )) as unknown[];
    const [staff] = (await manager.query(
      `SELECT 1 FROM personal WHERE id_personal = $1 AND estado = 'ACTIVO'`,
      [staffId],
    )) as unknown[];
    if (!patient) throw new BadRequestException('El paciente no esta activo');
    if (!staff) throw new BadRequestException('El personal no esta activo');
    if (treatmentId) {
      const rows = (await manager.query(
        `SELECT s.duracion_minutos FROM tratamientos_paciente t
         JOIN historiales h ON h.id_historial = t.id_historial
         JOIN servicios s ON s.id_servicio = t.id_servicio
         WHERE t.id_tratamiento = $1 AND h.id_paciente = $2
           AND t.estado IN ('PENDIENTE','EN_CURSO')`,
        [treatmentId, patientId],
      )) as Array<{ duracion_minutos: number }>;
      if (!rows.length)
        throw new BadRequestException(
          'El tratamiento no corresponde al paciente o no esta vigente',
        );
      if (
        (end.getTime() - start.getTime()) / 60000 !==
        rows[0].duracion_minutos
      )
        throw new BadRequestException(
          `La cita del tratamiento debe durar ${rows[0].duracion_minutos} minutos`,
        );
    }
    const local = this.localParts(start, end);
    const regular = (await manager.query(
      `SELECT 1 FROM horarios_personal
       WHERE id_personal = $1 AND dia_semana = $2 AND estado = true
         AND hora_inicio <= $3::time AND hora_fin >= $4::time`,
      [staffId, local.weekday, local.startTime, local.endTime],
    )) as unknown[];
    const extra = (await manager.query(
      `SELECT 1 FROM horarios_extra_personal
       WHERE id_personal = $1 AND fecha = $2::date AND estado = 'AUTORIZADO'
         AND hora_inicio <= $3::time AND hora_fin >= $4::time`,
      [staffId, local.date, local.startTime, local.endTime],
    )) as unknown[];
    if (!regular.length && !extra.length)
      throw new BadRequestException(
        'El personal no tiene disponibilidad autorizada en ese horario',
      );
    const blocked = (await manager.query(
      `SELECT 1 FROM bloqueos_personal
       WHERE id_personal = $1
         AND fecha_hora_inicio < $3 AND fecha_hora_fin > $2`,
      [staffId, start, end],
    )) as unknown[];
    if (blocked.length)
      throw new BadRequestException('El horario se encuentra bloqueado');
    const conflicts = (await manager.query(
      `SELECT 1 FROM citas
       WHERE (id_personal = $1 OR id_paciente = $2)
         AND estado IN ('PROGRAMADA','EN_ESPERA','ATENDIDA')
         AND fecha_hora_inicio < $4 AND fecha_hora_fin > $3
         AND ($5::integer IS NULL OR id_cita <> $5)`,
      [staffId, patientId, start, end, excludeId ?? null],
    )) as unknown[];
    if (conflicts.length)
      throw new BadRequestException(
        'El personal o el paciente ya tiene una cita en ese horario',
      );
  }
  private localParts(start: Date, end: Date) {
    const parts = (date: Date) =>
      Object.fromEntries(
        new Intl.DateTimeFormat('en-CA', {
          timeZone: 'America/La_Paz',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hourCycle: 'h23',
          weekday: 'long',
        })
          .formatToParts(date)
          .map((part) => [part.type, part.value]),
      );
    const startParts = parts(start);
    const endParts = parts(end);
    const weekdays: Record<string, string> = {
      Monday: 'LUNES',
      Tuesday: 'MARTES',
      Wednesday: 'MIERCOLES',
      Thursday: 'JUEVES',
      Friday: 'VIERNES',
      Saturday: 'SABADO',
      Sunday: 'DOMINGO',
    };
    const date = `${startParts.year}-${startParts.month}-${startParts.day}`;
    const endDate = `${endParts.year}-${endParts.month}-${endParts.day}`;
    if (date !== endDate)
      throw new BadRequestException(
        'Una cita no puede abarcar dias diferentes',
      );
    return {
      date,
      weekday: weekdays[startParts.weekday],
      startTime: `${startParts.hour}:${startParts.minute}:${startParts.second}`,
      endTime: `${endParts.hour}:${endParts.minute}:${endParts.second}`,
    };
  }
}
