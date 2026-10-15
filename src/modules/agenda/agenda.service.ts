import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import type {
  CreateCitaDto,
  CreateNotificacionCitaDto,
  AgendaQueryDto,
  NotificationQueryDto,
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
import {
  ConfiguracionHorarioAtencion,
  ExcepcionHorarioAtencion,
  Feriado,
  HorarioAtencionSemanal,
  TramoExcepcionHorarioAtencion,
} from '../empresa/entities/empresa.entities.js';
import { DiaSemana } from '../../common/enums/dia-semana.enum.js';

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
        dto.id_tratamiento ?? undefined,
        dto.numero_sesion ?? undefined,
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
  async list({
    page,
    limit,
    estado,
    search,
    desde,
    hasta,
    id_paciente,
    id_personal,
    id_tratamiento,
  }: AgendaQueryDto) {
    const query = this.appointmentDetailsQuery();
    if (estado) query.andWhere('cita.estado = :estado', { estado });
    if (id_paciente)
      query.andWhere('cita.id_paciente = :id_paciente', { id_paciente });
    if (id_personal)
      query.andWhere('cita.id_personal = :id_personal', { id_personal });
    if (id_tratamiento)
      query.andWhere('cita.id_tratamiento = :id_tratamiento', {
        id_tratamiento,
      });
    if (desde)
      query.andWhere('cita.fecha_hora_inicio >= :desde', {
        desde: new Date(desde),
      });
    if (hasta)
      query.andWhere('cita.fecha_hora_inicio <= :hasta', {
        hasta: new Date(hasta),
      });

    const normalizedSearch = search?.trim();
    if (normalizedSearch) {
      query.andWhere(
        `(
          CONCAT_WS(' ', pacientePersona.nombre, pacientePersona.ap_paterno, pacientePersona.ap_materno) ILIKE :search
          OR pacientePersona.ci ILIKE :search
          OR CONCAT_WS(' ', personalPersona.nombre, personalPersona.ap_paterno, personalPersona.ap_materno) ILIKE :search
          OR servicio.nombre ILIKE :search
          OR cita.observaciones ILIKE :search
        )`,
        { search: `%${normalizedSearch}%` },
      );
    }

    query
      .orderBy('cita.fecha_hora_inicio', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    const [data, total] = await query.getManyAndCount();
    return { data, total, page, limit };
  }
  async one(id: number) {
    const appointment = await this.appointmentDetailsQuery()
      .andWhere('cita.id_cita = :id', { id })
      .getOne();
    if (!appointment) return this.citas.one(id);
    return appointment;
  }
  async options() {
    const [
      patients,
      staff,
      treatments,
      businessHours,
      staffSchedules,
      staffExtraSchedules,
      staffBlocks,
    ] = await Promise.all([
      this.db.query(`
        SELECT
          p.id_paciente,
          pe.nombre,
          pe.ap_paterno,
          pe.ap_materno,
          pe.ci
        FROM pacientes p
        INNER JOIN personas pe ON pe.id_persona = p.id_persona
        WHERE p.estado = 'ACTIVO'
        ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno
      `),
      this.db.query(`
        SELECT
          pl.id_personal,
          u.id_usuario,
          u.foto_perfil_ruta,
          pe.nombre,
          pe.ap_paterno,
          pe.ap_materno,
          pl.profesion,
          pl.cargo,
          pl.color_agenda
        FROM personal pl
        INNER JOIN usuarios u ON u.id_usuario = pl.id_usuario
        INNER JOIN personas pe ON pe.id_persona = u.id_persona
        WHERE pl.estado = 'ACTIVO'
          AND u.estado = 'ACTIVO'
          AND UPPER(BTRIM(pl.cargo)) <> 'SECRETARIA'
        ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno
      `),
      this.db.query(`
        SELECT
          t.id_tratamiento,
          h.id_paciente,
          t.id_servicio,
          s.nombre AS servicio,
          s.duracion_minutos,
          t.sesiones_iniciales + COALESCE(SUM(a.sesiones_agregadas), 0)::integer AS sesiones_totales,
          COALESCE((
            SELECT MAX(c.numero_sesion)
            FROM citas c
            WHERE c.id_tratamiento = t.id_tratamiento
          ), 0)::integer + 1 AS siguiente_sesion,
          t.estado
        FROM tratamientos_paciente t
        INNER JOIN historiales h ON h.id_historial = t.id_historial
        INNER JOIN servicios s ON s.id_servicio = t.id_servicio
        LEFT JOIN ampliaciones_tratamiento a ON a.id_tratamiento = t.id_tratamiento
        WHERE t.estado IN ('PENDIENTE', 'EN_CURSO')
        GROUP BY t.id_tratamiento, h.id_paciente, s.id_servicio
        ORDER BY s.nombre, t.id_tratamiento
      `),
      this.readBusinessHours(this.db.manager),
      this.db.query(`
        SELECT
          id_horario,
          id_personal,
          dia_semana,
          TO_CHAR(hora_inicio, 'HH24:MI') AS hora_inicio,
          TO_CHAR(hora_fin, 'HH24:MI') AS hora_fin,
          motivo_pausa_anterior
        FROM horarios_personal
        WHERE estado = true
        ORDER BY id_personal, dia_semana, hora_inicio
      `),
      this.db.query(`
        SELECT
          id_horario_extra,
          id_personal,
          TO_CHAR(fecha, 'YYYY-MM-DD') AS fecha,
          TO_CHAR(hora_inicio, 'HH24:MI') AS hora_inicio,
          TO_CHAR(hora_fin, 'HH24:MI') AS hora_fin,
          motivo
        FROM horarios_extra_personal
        WHERE estado = 'AUTORIZADO'
        ORDER BY fecha, id_personal, hora_inicio
      `),
      this.db.query(`
        SELECT
          id_bloqueo,
          id_personal,
          fecha_hora_inicio,
          fecha_hora_fin,
          motivo
        FROM bloqueos_personal
        WHERE estado = true
        ORDER BY fecha_hora_inicio, id_personal
      `),
    ]);
    return {
      patients,
      staff,
      treatments,
      businessHours,
      staffSchedules,
      staffExtraSchedules,
      staffBlocks,
    };
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
        dto.id_tratamiento !== undefined ||
        dto.numero_sesion !== undefined
      )
        await this.ensureAvailability(
          manager,
          dto.id_paciente ?? current.id_paciente,
          dto.id_personal ?? current.id_personal,
          dto.id_tratamiento === null
            ? undefined
            : (dto.id_tratamiento ?? current.id_tratamiento ?? undefined),
          dto.numero_sesion === null
            ? undefined
            : (dto.numero_sesion ?? current.numero_sesion ?? undefined),
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
        cita.numero_sesion ?? undefined,
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
  async listNotifications(q: NotificationQueryDto) {
    const values: unknown[]=[];const conditions:string[]=[];const parameter=(value:unknown)=>{values.push(value);return `$${values.length}`};
    if(q.estado)conditions.push(`n.estado::text=${parameter(q.estado)}`);if(q.tipo)conditions.push(`n.tipo::text=${parameter(q.tipo)}`);
    if(q.search){const value=parameter(`%${q.search}%`);conditions.push(`(pe.nombre ILIKE ${value} OR pe.ap_paterno ILIKE ${value} OR sv.nombre ILIKE ${value})`)}
    const where=conditions.length?`WHERE ${conditions.join(' AND ')}`:'';const[count]=(await this.db.manager.query(`SELECT COUNT(*)::int AS total FROM notificaciones_cita n JOIN citas c ON c.id_cita=n.id_cita JOIN pacientes pa ON pa.id_paciente=c.id_paciente JOIN personas pe ON pe.id_persona=pa.id_persona LEFT JOIN tratamientos_paciente t ON t.id_tratamiento=c.id_tratamiento LEFT JOIN servicios sv ON sv.id_servicio=t.id_servicio ${where}`,values))as Array<{total:number}>;const limit=parameter(q.limit),offset=parameter((q.page-1)*q.limit);const data=await this.db.manager.query(`SELECT n.*,c.fecha_hora_inicio,pe.nombre||' '||pe.ap_paterno||' '||pe.ap_materno AS paciente,COALESCE(sv.nombre,'Cita general') AS servicio FROM notificaciones_cita n JOIN citas c ON c.id_cita=n.id_cita JOIN pacientes pa ON pa.id_paciente=c.id_paciente JOIN personas pe ON pe.id_persona=pa.id_persona LEFT JOIN tratamientos_paciente t ON t.id_tratamiento=c.id_tratamiento LEFT JOIN servicios sv ON sv.id_servicio=t.id_servicio ${where} ORDER BY n.programada_para DESC LIMIT ${limit} OFFSET ${offset}`,values);return{data,total:Number(count?.total??0),page:q.page,limit:q.limit};
  }
  async notificationOptions(){return this.db.manager.query(`SELECT c.id_cita,c.fecha_hora_inicio,c.estado,pe.nombre||' '||pe.ap_paterno||' '||pe.ap_materno AS paciente,COALESCE(sv.nombre,'Cita general') AS servicio FROM citas c JOIN pacientes pa ON pa.id_paciente=c.id_paciente JOIN personas pe ON pe.id_persona=pa.id_persona LEFT JOIN tratamientos_paciente t ON t.id_tratamiento=c.id_tratamiento LEFT JOIN servicios sv ON sv.id_servicio=t.id_servicio WHERE c.estado IN ('PROGRAMADA','EN_ESPERA') ORDER BY c.fecha_hora_inicio ASC`)}
  oneNotification(id: number) {
    return this.notifications.one(id);
  }
  updateNotification(id: number, dto: UpdateNotificacionCitaDto) {
    return this.notifications.update(id, this.mapNotification(dto));
  }
  private appointmentDetailsQuery() {
    return this.db
      .getRepository(Cita)
      .createQueryBuilder('cita')
      .leftJoinAndSelect('cita.paciente', 'paciente')
      .leftJoinAndSelect('paciente.persona', 'pacientePersona')
      .leftJoinAndSelect('cita.personal', 'personal')
      .leftJoinAndSelect('personal.usuario', 'personalUsuario')
      .leftJoinAndSelect('personalUsuario.persona', 'personalPersona')
      .leftJoinAndSelect('cita.tratamiento', 'tratamiento')
      .leftJoinAndSelect('tratamiento.servicio', 'servicio');
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
    sessionNumber: number | undefined,
    start: Date,
    end: Date,
    excludeId?: number,
  ) {
    const [patient] = (await manager.query(
      `SELECT 1 FROM pacientes WHERE id_paciente = $1 AND estado = 'ACTIVO'`,
      [patientId],
    )) as unknown[];
    const [staff] = (await manager.query(
      `SELECT 1 FROM personal
       WHERE id_personal = $1
         AND estado = 'ACTIVO'
         AND UPPER(BTRIM(cargo)) <> 'SECRETARIA'`,
      [staffId],
    )) as unknown[];
    if (!patient) throw new BadRequestException('El paciente no esta activo');
    if (!staff)
      throw new BadRequestException(
        'El personal no esta activo o no realiza atenciones',
      );
    if (!treatmentId && sessionNumber)
      throw new BadRequestException(
        'El numero de sesion requiere un tratamiento',
      );
    if (treatmentId) {
      if (!sessionNumber)
        throw new BadRequestException(
          'Debes indicar el numero de sesion del tratamiento',
        );
      const rows = (await manager.query(
        `SELECT
           s.duracion_minutos,
           t.sesiones_iniciales + COALESCE((
             SELECT SUM(a.sesiones_agregadas)
             FROM ampliaciones_tratamiento a
             WHERE a.id_tratamiento = t.id_tratamiento
           ), 0)::integer AS sesiones_totales
         FROM tratamientos_paciente t
         JOIN historiales h ON h.id_historial = t.id_historial
         JOIN servicios s ON s.id_servicio = t.id_servicio
         WHERE t.id_tratamiento = $1 AND h.id_paciente = $2
           AND t.estado IN ('PENDIENTE','EN_CURSO')`,
        [treatmentId, patientId],
      )) as Array<{ duracion_minutos: number; sesiones_totales: number }>;
      if (!rows.length)
        throw new BadRequestException(
          'El tratamiento no corresponde al paciente o no esta vigente',
        );
      if (sessionNumber > Number(rows[0].sesiones_totales))
        throw new BadRequestException(
          `El tratamiento solo dispone de ${rows[0].sesiones_totales} sesiones`,
        );
      const duplicated = (await manager.query(
        `SELECT 1 FROM citas
         WHERE id_tratamiento = $1 AND numero_sesion = $2
           AND ($3::integer IS NULL OR id_cita <> $3)`,
        [treatmentId, sessionNumber, excludeId ?? null],
      )) as unknown[];
      if (duplicated.length)
        throw new BadRequestException(
          'Ese numero de sesion ya fue reservado para el tratamiento',
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
    await this.ensureBusinessHours(manager, local);
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
         AND estado = true
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
  private async readBusinessHours(manager: EntityManager) {
    const config = await manager
      .getRepository(ConfiguracionHorarioAtencion)
      .findOne({
        where: {},
        order: { id_configuracion_horario: 'ASC' },
      });
    if (!config)
      return {
        intervalo_minutos: 30,
        horarios_semanales: [
          DiaSemana.LUNES,
          DiaSemana.MARTES,
          DiaSemana.MIERCOLES,
          DiaSemana.JUEVES,
          DiaSemana.VIERNES,
          DiaSemana.SABADO,
        ].map((dia_semana) => ({ dia_semana, hora_inicio: '07:00', hora_fin: '20:00' })),
        excepciones: [],
        feriados: [],
      };
    const weekly = await manager.getRepository(HorarioAtencionSemanal).find({
      where: { id_configuracion_horario: config.id_configuracion_horario },
      order: { dia_semana: 'ASC', hora_inicio: 'ASC' },
    });
    const exceptions = await manager.getRepository(ExcepcionHorarioAtencion).find({
      where: { id_configuracion_horario: config.id_configuracion_horario },
      order: { fecha: 'ASC' },
    });
    const exceptionRanges = exceptions.length
      ? await manager.getRepository(TramoExcepcionHorarioAtencion)
          .createQueryBuilder('range')
          .where('range.id_excepcion_horario IN (:...ids)', {
            ids: exceptions.map((item) => item.id_excepcion_horario),
          })
          .orderBy('range.hora_inicio', 'ASC')
          .getMany()
      : [];
    const holidays = await manager.getRepository(Feriado).find({
      where: { id_configuracion_horario: config.id_configuracion_horario },
      order: { mes: 'ASC', dia: 'ASC', fecha: 'ASC' },
    });
    return {
      intervalo_minutos: config.intervalo_minutos,
      horarios_semanales: weekly.map((item) => ({
        dia_semana: item.dia_semana,
        hora_inicio: item.hora_inicio.slice(0, 5),
        hora_fin: item.hora_fin.slice(0, 5),
      })),
      excepciones: exceptions.map((item) => ({
        fecha: item.fecha,
        tipo: item.tipo,
        motivo: item.motivo,
        tramos: exceptionRanges
          .filter((range) => range.id_excepcion_horario === item.id_excepcion_horario)
          .map((range) => ({
            hora_inicio: range.hora_inicio.slice(0, 5),
            hora_fin: range.hora_fin.slice(0, 5),
          })),
      })),
      feriados: holidays.map((item) => ({
        tipo: item.tipo,
        nombre: item.nombre,
        mes: item.mes,
        dia: item.dia,
        fecha: item.fecha,
      })),
    };
  }
  private async ensureBusinessHours(
    manager: EntityManager,
    local: {
      date: string;
      weekday: string;
      startTime: string;
      endTime: string;
    },
  ) {
    const schedule = await this.readBusinessHours(manager);
    const exception = schedule.excepciones.find((item) => item.fecha === local.date);
    if (exception?.tipo === 'CERRADO')
      throw new BadRequestException(
        exception.motivo
          ? `El establecimiento permanecerá cerrado: ${exception.motivo}`
          : 'El establecimiento permanecerá cerrado en la fecha seleccionada',
      );
    const [, month, day] = local.date.split('-').map(Number);
    const holiday = schedule.feriados.find(
      (item) => item.tipo === 'DINAMICO'
        ? item.fecha === local.date
        : item.mes === month && item.dia === day,
    );
    if (holiday && exception?.tipo !== 'HORARIO_ESPECIAL')
      throw new BadRequestException(`El establecimiento permanecerá cerrado: ${holiday.nombre}`);
    const ranges = exception?.tipo === 'HORARIO_ESPECIAL'
      ? exception.tramos
      : schedule.horarios_semanales.filter(
          (item) => item.dia_semana === (local.weekday as DiaSemana),
        );
    if (!ranges.length)
      throw new BadRequestException('La fecha seleccionada no tiene horario de atención');
    const toMinutes = (value: string) => {
      const [hours, minutes] = value.split(':').map(Number);
      return hours * 60 + minutes;
    };
    const start = toMinutes(local.startTime);
    const end = toMinutes(local.endTime);
    const containingRange = ranges.find(
      (range) => start >= toMinutes(range.hora_inicio) && end <= toMinutes(range.hora_fin),
    );
    if (!containingRange)
      throw new BadRequestException(
        `La cita debe estar dentro de un tramo de atención: ${ranges.map((range) => `${range.hora_inicio}–${range.hora_fin}`).join(' o ')}`,
      );
    const opening = toMinutes(containingRange.hora_inicio);
    if ((start - opening) % schedule.intervalo_minutos !== 0)
      throw new BadRequestException(
        `La hora de inicio debe coincidir con intervalos de ${schedule.intervalo_minutos} minutos desde las ${containingRange.hora_inicio}`,
      );
  }
}
