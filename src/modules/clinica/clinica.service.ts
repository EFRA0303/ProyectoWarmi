import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { completeAcquisition, requireAcquisitionPayment } from '../ventas/commercial-cancellation.js';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import type {
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
  AmpliacionTratamiento,
  Sesion,
  SolicitudServicio,
  TratamientoPaciente,
  Valoracion,
  ValoracionMedida,
} from './entities/clinica.entities.js';
import {
  EstadoCita,
  EstadoSesion,
  EstadoSolicitud,
  EstadoTratamiento,
} from '../../common/enums/domain.enums.js';
@Injectable()
export class ClinicaService {
  private solicitudes: DomainResourceService<SolicitudServicio>;
  private tratamientos: DomainResourceService<TratamientoPaciente>;
  private sesiones: DomainResourceService<Sesion>;
  private valoraciones: DomainResourceService<Valoracion>;
  constructor(@Inject(DataSource) private readonly db: DataSource) {
    this.solicitudes = new DomainResourceService(
      SolicitudServicio,
      'id_solicitud',
      db.getRepository(SolicitudServicio),
      'Solicitud',
    );
    this.tratamientos = new DomainResourceService(
      TratamientoPaciente,
      'id_tratamiento',
      db.getRepository(TratamientoPaciente),
      'Tratamiento',
    );
    this.sesiones = new DomainResourceService(
      Sesion,
      'id_sesion',
      db.getRepository(Sesion),
      'Sesion',
    );
    this.valoraciones = new DomainResourceService(
      Valoracion,
      'id_valoracion',
      db.getRepository(Valoracion),
      'Valoracion',
    );
  }
  async createSolicitud(d: CreateSolicitudDto) {
    await this.ensureHistoryAndService(d.id_historial, d.id_servicio);
    const duplicate = (await this.db.manager.query(
      `SELECT 1 FROM solicitudes_servicio
       WHERE id_historial = $1 AND id_servicio = $2
         AND estado IN ('PENDIENTE', 'VALORADO')
       LIMIT 1`,
      [d.id_historial, d.id_servicio],
    )) as unknown[];
    if (duplicate.length)
      throw new BadRequestException(
        'Ya existe una solicitud pendiente o valorada para este servicio',
      );
    return this.solicitudes.create(
      Object.assign({}, d, {
        fecha_solicitud: new Date(d.fecha_solicitud),
        estado: EstadoSolicitud.PENDIENTE,
      }),
    );
  }
  async listSolicitudes(q: DomainQueryDto) {
    const { page, limit, estado, search, desde, hasta } = q;
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (estado)
      conditions.push(`sol.estado::text = ${parameter(estado.toUpperCase())}`);
    if (q.id_paciente)
      conditions.push(`h.id_paciente = ${parameter(q.id_paciente)}`);
    if (q.id_historial)
      conditions.push(`sol.id_historial = ${parameter(q.id_historial)}`);
    if (q.id_servicio)
      conditions.push(`sol.id_servicio = ${parameter(q.id_servicio)}`);
    if (desde)
      conditions.push(`sol.fecha_solicitud >= ${parameter(desde)}::date`);
    if (hasta)
      conditions.push(
        `sol.fecha_solicitud < (${parameter(hasta)}::date + INTERVAL '1 day')`,
      );
    if (search) {
      const value = parameter(`%${search}%`);
      conditions.push(`(
        CONCAT_WS(' ', persona.nombre, persona.ap_paterno, persona.ap_materno) ILIKE ${value}
        OR COALESCE(persona.ci, '') ILIKE ${value}
        OR servicio.nombre ILIKE ${value}
        OR COALESCE(sol.motivo, '') ILIKE ${value}
      )`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const joins = `
      JOIN historiales h ON h.id_historial = sol.id_historial
      JOIN pacientes paciente ON paciente.id_paciente = h.id_paciente
      JOIN personas persona ON persona.id_persona = paciente.id_persona
      JOIN servicios servicio ON servicio.id_servicio = sol.id_servicio
      JOIN categorias_servicio categoria ON categoria.id_categoria = servicio.id_categoria
      JOIN areas area ON area.id_area = categoria.id_area`;
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total
       FROM solicitudes_servicio sol ${joins} ${where}`,
      values,
    )) as Array<{ total: number }>;
    const offset = (page - 1) * limit;
    const limitParameter = parameter(limit);
    const offsetParameter = parameter(offset);
    const data = (await this.db.manager.query(
      `SELECT sol.id_solicitud, sol.id_historial, sol.id_servicio,
              sol.fecha_solicitud, sol.motivo, sol.estado,
              h.id_paciente,
              CONCAT_WS(' ', persona.nombre, persona.ap_paterno, persona.ap_materno) AS paciente,
              persona.ci, servicio.nombre AS servicio,
              servicio.requiere_valoracion, categoria.nombre AS categoria,
              area.nombre AS area,
              (SELECT COUNT(*)::int FROM valoraciones v
               WHERE v.id_solicitud = sol.id_solicitud) AS valoraciones,
              (SELECT MAX(v.fecha_valoracion) FROM valoraciones v
               WHERE v.id_solicitud = sol.id_solicitud) AS ultima_valoracion
       FROM solicitudes_servicio sol
       ${joins}
       ${where}
       ORDER BY sol.fecha_solicitud DESC, sol.id_solicitud DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values,
    )) as unknown[];
    return { data, total: Number(count?.total ?? 0), page, limit };
  }
  async opcionesSolicitudes() {
    const [patients, services] = await Promise.all([
      this.db.manager.query(`
        SELECT h.id_historial, p.id_paciente, pe.nombre, pe.ap_paterno,
               pe.ap_materno, pe.ci
        FROM historiales h
        JOIN pacientes p ON p.id_paciente = h.id_paciente
        JOIN personas pe ON pe.id_persona = p.id_persona
        WHERE h.estado = 'ACTIVO' AND p.estado = 'ACTIVO'
        ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno`),
      this.db.manager.query(`
        SELECT s.id_servicio, s.nombre, s.descripcion, s.duracion_minutos,
               s.requiere_valoracion, c.nombre AS categoria, a.nombre AS area
        FROM servicios s
        JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
        JOIN areas a ON a.id_area = c.id_area
        WHERE s.estado = 'ACTIVO' AND c.estado = 'ACTIVO' AND a.estado = 'ACTIVO'
        ORDER BY a.nombre, c.nombre, s.nombre`),
    ]);
    return { patients, services };
  }
  oneSolicitud(id: number) {
    return this.solicitudes.one(id);
  }
  async updateSolicitud(id: number, d: UpdateSolicitudDto) {
    const current = await this.solicitudes.one(id);
    if (d.estado) this.ensureSolicitudTransition(current.estado, d.estado);
    return this.solicitudes.update(id, Object.assign({}, d));
  }
  async createTratamiento(d: CreateTratamientoDto) {
    return this.db.transaction(async (manager) => {
      if (!d.id_detalle_adquisicion) throw new BadRequestException('Primero registra la adquisición del paciente y su primer pago; después selecciona la adquisición al asignar el servicio');
      await requireAcquisitionPayment(manager, d.id_detalle_adquisicion);
      const historyId = await this.resolveTreatmentHistory(
        d.id_paciente,
        d.id_historial,
        manager,
      );
      await this.ensureHistoryAndService(historyId, d.id_servicio, manager);
      await this.ensureActiveStaff(d.indicado_por, manager);
      if (d.id_detalle_adquisicion)
        await this.ensureAcquisitionCoverage(
          d.id_detalle_adquisicion,
          historyId,
          d.id_servicio,
          d.sesiones_iniciales,
          manager,
        );

      const { id_paciente: _patientId, id_historial: _historyId, ...data } = d;
      const repository = manager.getRepository(TratamientoPaciente);
      return repository.save(
        repository.create({
          ...data,
          id_historial: historyId,
          estado: EstadoTratamiento.PENDIENTE,
        }),
      );
    });
  }
  async listTratamientos(q: DomainQueryDto) {
    const { page, limit, estado, search, desde, hasta } = q;
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (estado)
      conditions.push(`t.estado::text = ${parameter(estado.toUpperCase())}`);
    if (q.id_paciente)
      conditions.push(`h.id_paciente = ${parameter(q.id_paciente)}`);
    if (q.id_personal)
      conditions.push(`t.indicado_por = ${parameter(q.id_personal)}`);
    if (q.id_servicio)
      conditions.push(`t.id_servicio = ${parameter(q.id_servicio)}`);
    if (desde) conditions.push(`t.fecha_inicio >= ${parameter(desde)}::date`);
    if (hasta) conditions.push(`t.fecha_inicio <= ${parameter(hasta)}::date`);
    if (search) {
      const value = parameter(`%${search}%`);
      conditions.push(`(
        CONCAT_WS(' ', paciente.nombre, paciente.ap_paterno, paciente.ap_materno) ILIKE ${value}
        OR COALESCE(paciente.ci, '') ILIKE ${value}
        OR servicio.nombre ILIKE ${value}
        OR CONCAT_WS(' ', profesional.nombre, profesional.ap_paterno, profesional.ap_materno) ILIKE ${value}
      )`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    const limitParameter = parameter(limit);
    const offsetParameter = parameter(offset);
    const rows = (await this.db.manager.query(
      `SELECT
         t.id_tratamiento,
         t.id_historial,
         h.id_paciente,
         CONCAT_WS(' ', paciente.nombre, paciente.ap_paterno, paciente.ap_materno) AS paciente,
         paciente.ci,
         t.id_servicio,
         servicio.nombre AS servicio,
         servicio.duracion_minutos,
         servicio.requiere_valoracion,
         t.indicado_por,
         CONCAT_WS(' ', profesional.nombre, profesional.ap_paterno, profesional.ap_materno) AS profesional,
         personal.color_agenda,
         t.id_detalle_adquisicion,
         t.sesiones_iniciales,
         COALESCE((
           SELECT SUM(ampliacion.sesiones_agregadas)
           FROM ampliaciones_tratamiento ampliacion
           WHERE ampliacion.id_tratamiento = t.id_tratamiento
         ), 0)::integer AS sesiones_agregadas,
         (SELECT COUNT(*) FROM sesiones sesion
          WHERE sesion.id_tratamiento = t.id_tratamiento
            AND sesion.estado = 'FINALIZADA')::integer AS sesiones_realizadas,
         (SELECT COUNT(*) FROM citas cita
          WHERE cita.id_tratamiento = t.id_tratamiento
            AND cita.estado IN ('PROGRAMADA', 'EN_ESPERA'))::integer AS citas_pendientes,
         t.fecha_inicio,
         t.estado,
         t.observaciones,
         COUNT(*) OVER()::integer AS total_registros
       FROM tratamientos_paciente t
       JOIN historiales h ON h.id_historial = t.id_historial
       JOIN pacientes p ON p.id_paciente = h.id_paciente
       JOIN personas paciente ON paciente.id_persona = p.id_persona
       JOIN servicios servicio ON servicio.id_servicio = t.id_servicio
       JOIN personal personal ON personal.id_personal = t.indicado_por
       JOIN usuarios usuario_profesional ON usuario_profesional.id_usuario = personal.id_usuario
       JOIN personas profesional ON profesional.id_persona = usuario_profesional.id_persona
       ${where}
       ORDER BY t.id_tratamiento DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values,
    )) as Array<Record<string, unknown> & { total_registros: number }>;
    const total = rows.length ? Number(rows[0].total_registros) : 0;
    const data = rows.map(
      ({ total_registros: _total, ...treatment }) => treatment,
    );
    return { data, total, page, limit };
  }
  async opcionesTratamientos() {
    const [patients, services, staff, acquisitions] = await Promise.all([
      this.db.manager.query(`
        SELECT
          h.id_historial,
          p.id_paciente,
          pe.nombre,
          pe.ap_paterno,
          pe.ap_materno,
          pe.ci
        FROM pacientes p
        JOIN personas pe ON pe.id_persona = p.id_persona
        LEFT JOIN historiales h ON h.id_paciente = p.id_paciente
        WHERE p.estado = 'ACTIVO'
        ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno
      `),
      this.db.manager.query(`
        SELECT
          s.id_servicio,
          s.nombre,
          s.duracion_minutos,
          s.descripcion,
          s.requiere_valoracion,
          s.sesiones_incluidas,
          s.precio,
          c.nombre AS categoria,
          a.nombre AS area
        FROM servicios s
        JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
        JOIN areas a ON a.id_area = c.id_area
        WHERE s.estado = 'ACTIVO'
          AND c.estado = 'ACTIVO'
          AND a.estado = 'ACTIVO'
        ORDER BY a.nombre, c.nombre, s.nombre
      `),
      this.db.manager.query(`
        SELECT
          pl.id_personal,
          pe.nombre,
          pe.ap_paterno,
          pe.ap_materno,
          pl.profesion,
          pl.cargo,
          pl.color_agenda
        FROM personal pl
        JOIN usuarios u ON u.id_usuario = pl.id_usuario
        JOIN personas pe ON pe.id_persona = u.id_persona
        WHERE pl.estado = 'ACTIVO'
          AND u.estado = 'ACTIVO'
          AND UPPER(BTRIM(pl.cargo)) <> 'SECRETARIA'
        ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno
      `),
      this.db.manager.query(`
        SELECT
          d.id_detalle_adquisicion,
          a.id_paciente,
          d.id_servicio,
          d.nombre_servicio_snapshot,
          d.sesiones_incluidas,
          (
            d.sesiones_incluidas - COALESCE((
              SELECT SUM(t.sesiones_iniciales)
              FROM tratamientos_paciente t
              WHERE t.id_detalle_adquisicion = d.id_detalle_adquisicion
                AND t.estado <> 'CANCELADO'
            ), 0)
          )::integer AS sesiones_disponibles
        FROM detalles_adquisicion d
        JOIN adquisiciones a ON a.id_adquisicion = d.id_adquisicion
        WHERE a.estado <> 'CANCELADA'
          AND d.sesiones_incluidas > COALESCE((
            SELECT SUM(t.sesiones_iniciales)
            FROM tratamientos_paciente t
            WHERE t.id_detalle_adquisicion = d.id_detalle_adquisicion
              AND t.estado <> 'CANCELADO'
          ), 0)
        ORDER BY a.id_paciente, d.nombre_servicio_snapshot
      `),
    ]);
    return { patients, services, staff, acquisitions };
  }
  oneTratamiento(id: number) {
    return this.tratamientos.one(id);
  }
  async updateTratamiento(id: number, d: UpdateTratamientoDto) {
    const current = await this.tratamientos.one(id);
    if (d.estado === EstadoTratamiento.CANCELADO)
      throw new BadRequestException(
        'Utiliza la operación de cancelación para cancelar el tratamiento',
      );
    if (d.estado) this.ensureTreatmentTransition(current.estado, d.estado);
    if (d.estado === EstadoTratamiento.FINALIZADO) {
      const [progress] = (await this.db.manager.query(
        `SELECT (SELECT COUNT(*) FROM sesiones s
                 WHERE s.id_tratamiento = t.id_tratamiento
                   AND s.estado = 'FINALIZADA')::integer AS realizadas,
                t.sesiones_iniciales + COALESCE((
                  SELECT SUM(a.sesiones_agregadas)
                  FROM ampliaciones_tratamiento a
                  WHERE a.id_tratamiento = t.id_tratamiento
                ),0) AS total
         FROM tratamientos_paciente t WHERE t.id_tratamiento = $1`,
        [id],
      )) as Array<{ realizadas: number; total: string }>;
      if (!progress || progress.realizadas < Number(progress.total))
        throw new BadRequestException(
          'No se puede finalizar mientras existan sesiones pendientes',
        );
    }
    return this.tratamientos.update(id, d);
  }
  async cancelarTratamiento(id: number) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(TratamientoPaciente);
      const current = await repository.findOne({
        where: { id_tratamiento: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!current) return this.tratamientos.one(id, manager);
      this.ensureTreatmentTransition(
        current.estado,
        EstadoTratamiento.CANCELADO,
      );
      const activeSessions = (await manager.query(
        `SELECT 1 FROM sesiones
         WHERE id_tratamiento = $1
           AND estado = 'EN_CURSO'
         LIMIT 1`,
        [id],
      )) as unknown[];
      if (activeSessions.length)
        throw new BadRequestException(
          'Finaliza o cancela primero la sesión que está en curso',
        );
      const pendingAppointments = (await manager.query(
        `SELECT 1 FROM citas
         WHERE id_tratamiento = $1
           AND estado IN ('PROGRAMADA', 'EN_ESPERA')
         LIMIT 1`,
        [id],
      )) as unknown[];
      if (pendingAppointments.length)
        throw new BadRequestException(
          'Cancela primero las citas pendientes de este tratamiento',
        );
      current.estado = EstadoTratamiento.CANCELADO;
      return repository.save(current);
    });
  }
  async ampliar(id: number, d: CreateAmpliacionDto) {
    const treatment = await this.tratamientos.one(id);
    if (
      ![EstadoTratamiento.PENDIENTE, EstadoTratamiento.EN_CURSO].includes(
        treatment.estado,
      )
    )
      throw new BadRequestException(
        'No se puede ampliar un tratamiento finalizado o cancelado',
      );
    await this.ensureActiveStaff(d.autorizado_por);
    const r = this.db.getRepository(AmpliacionTratamiento);
    return r.save(
      r.create(
        Object.assign({}, d, {
          id_tratamiento: id,
          fecha_ampliacion: new Date(d.fecha_ampliacion),
        }),
      ),
    );
  }
  async ampliaciones(id: number) {
    await this.tratamientos.one(id);
    return this.db.getRepository(AmpliacionTratamiento).find({
      where: { id_tratamiento: id },
      order: { fecha_ampliacion: 'ASC' },
    });
  }
  createSesion(d: CreateSesionDto) {
    return this.db.transaction(async (manager) => {
      const sessionStart = new Date(d.fecha_sesion);
      if (sessionStart > new Date())
        throw new BadRequestException(
          'La sesion no puede iniciarse en una fecha futura',
        );
      const treatment = await manager
        .getRepository(TratamientoPaciente)
        .findOne({
          where: { id_tratamiento: d.id_tratamiento },
          lock: { mode: 'pessimistic_write' },
        });
      if (
        !treatment ||
        ![EstadoTratamiento.PENDIENTE, EstadoTratamiento.EN_CURSO].includes(
          treatment.estado,
        )
      )
        throw new BadRequestException(
          'El tratamiento no existe o no admite nuevas sesiones',
        );
      await this.ensureActiveStaff(d.atendido_por, manager);
      if (treatment.id_detalle_adquisicion) await requireAcquisitionPayment(manager, treatment.id_detalle_adquisicion);
      const [quota] = (await manager.query(
        `SELECT t.sesiones_iniciales + COALESCE(SUM(a.sesiones_agregadas),0) AS total
         FROM tratamientos_paciente t
         LEFT JOIN ampliaciones_tratamiento a ON a.id_tratamiento = t.id_tratamiento
         WHERE t.id_tratamiento = $1 GROUP BY t.id_tratamiento`,
        [d.id_tratamiento],
      )) as Array<{ total: string }>;
      const used = await manager
        .getRepository(Sesion)
        .createQueryBuilder('sesion')
        .where('sesion.id_tratamiento = :id', { id: d.id_tratamiento })
        .andWhere('sesion.estado IN (:...states)', {
          states: [EstadoSesion.EN_CURSO, EstadoSesion.FINALIZADA],
        })
        .getCount();
      if (!quota || used >= Number(quota.total))
        throw new BadRequestException(
          'El tratamiento ya utilizo todas sus sesiones disponibles',
        );
      if (
        await manager.getRepository(Sesion).existsBy({
          id_tratamiento: d.id_tratamiento,
          estado: EstadoSesion.EN_CURSO,
        })
      )
        throw new BadRequestException(
          'El tratamiento ya tiene una sesion en curso',
        );
      if (d.id_cita) {
        const rows = (await manager.query(
          `SELECT 1 FROM citas
           WHERE id_cita = $1 AND id_tratamiento = $2
             AND id_personal = $3 AND estado = 'EN_ESPERA'`,
          [d.id_cita, d.id_tratamiento, d.atendido_por],
        )) as unknown[];
        if (!rows.length)
          throw new BadRequestException(
            'La cita no corresponde al tratamiento, personal o estado requerido',
          );
      }
      const session = await this.sesiones.create(
        Object.assign({}, d, {
          fecha_sesion: sessionStart,
          finalizada_en: null,
          estado: EstadoSesion.EN_CURSO,
        }),
        manager,
      );
      if (treatment.estado === EstadoTratamiento.PENDIENTE) {
        treatment.estado = EstadoTratamiento.EN_CURSO;
        treatment.fecha_inicio ??= d.fecha_sesion.slice(0, 10);
        await manager.getRepository(TratamientoPaciente).save(treatment);
      }
      return session;
    });
  }
  async listSesiones(q: DomainQueryDto) {
    const { page, limit, estado, search, desde, hasta } = q;
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (estado)
      conditions.push(`se.estado::text = ${parameter(estado.toUpperCase())}`);
    if (q.id_paciente)
      conditions.push(`h.id_paciente = ${parameter(q.id_paciente)}`);
    if (q.id_personal)
      conditions.push(`se.atendido_por = ${parameter(q.id_personal)}`);
    if (q.id_tratamiento)
      conditions.push(`se.id_tratamiento = ${parameter(q.id_tratamiento)}`);
    if (q.id_servicio)
      conditions.push(`t.id_servicio = ${parameter(q.id_servicio)}`);
    if (desde)
      conditions.push(`se.fecha_sesion >= ${parameter(desde)}::timestamptz`);
    if (hasta)
      conditions.push(`se.fecha_sesion <= ${parameter(hasta)}::timestamptz`);
    if (search) {
      const value = parameter(`%${search}%`);
      conditions.push(`(
        CONCAT_WS(' ', paciente.nombre, paciente.ap_paterno, paciente.ap_materno) ILIKE ${value}
        OR COALESCE(paciente.ci, '') ILIKE ${value}
        OR servicio.nombre ILIKE ${value}
        OR CONCAT_WS(' ', profesional.nombre, profesional.ap_paterno, profesional.ap_materno) ILIKE ${value}
      )`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;
    const limitParameter = parameter(limit);
    const offsetParameter = parameter(offset);
    const rows = (await this.db.manager.query(
      `SELECT
         se.id_sesion,
         se.id_tratamiento,
         se.id_cita,
         se.atendido_por,
         se.fecha_sesion,
         se.finalizada_en,
         se.estado,
         se.observaciones,
         h.id_historial,
         h.id_paciente,
         CONCAT_WS(' ', paciente.nombre, paciente.ap_paterno, paciente.ap_materno) AS paciente,
         paciente.ci,
         t.id_servicio,
         servicio.nombre AS servicio,
         servicio.duracion_minutos,
         CONCAT_WS(' ', profesional.nombre, profesional.ap_paterno, profesional.ap_materno) AS profesional,
         personal.color_agenda,
         cita.numero_sesion,
         cita.fecha_hora_inicio AS cita_inicio,
         cita.fecha_hora_fin AS cita_fin,
         COUNT(*) OVER()::integer AS total_registros
       FROM sesiones se
       JOIN tratamientos_paciente t ON t.id_tratamiento = se.id_tratamiento
       JOIN historiales h ON h.id_historial = t.id_historial
       JOIN pacientes p ON p.id_paciente = h.id_paciente
       JOIN personas paciente ON paciente.id_persona = p.id_persona
       JOIN servicios servicio ON servicio.id_servicio = t.id_servicio
       JOIN personal personal ON personal.id_personal = se.atendido_por
       JOIN usuarios usuario_profesional ON usuario_profesional.id_usuario = personal.id_usuario
       JOIN personas profesional ON profesional.id_persona = usuario_profesional.id_persona
       LEFT JOIN citas cita ON cita.id_cita = se.id_cita
       ${where}
       ORDER BY se.fecha_sesion DESC, se.id_sesion DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values,
    )) as Array<Record<string, unknown> & { total_registros: number }>;
    const total = rows.length ? Number(rows[0].total_registros) : 0;
    const data = rows.map(({ total_registros: _total, ...session }) => session);
    return { data, total, page, limit };
  }
  async opcionesSesiones() {
    const [appointments, treatments, staff] = await Promise.all([
      this.db.manager.query(`
        SELECT
          c.id_cita,
          c.id_tratamiento,
          c.id_personal,
          c.numero_sesion,
          c.fecha_hora_inicio,
          c.fecha_hora_fin,
          h.id_paciente,
          CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) AS paciente,
          pe.ci,
          s.nombre AS servicio,
          s.duracion_minutos,
          CONCAT_WS(' ', pp.nombre, pp.ap_paterno, pp.ap_materno) AS profesional
        FROM citas c
        JOIN tratamientos_paciente t ON t.id_tratamiento = c.id_tratamiento
        JOIN historiales h ON h.id_historial = t.id_historial
        JOIN pacientes p ON p.id_paciente = h.id_paciente
        JOIN personas pe ON pe.id_persona = p.id_persona
        JOIN servicios s ON s.id_servicio = t.id_servicio
        JOIN personal pl ON pl.id_personal = c.id_personal
        JOIN usuarios u ON u.id_usuario = pl.id_usuario
        JOIN personas pp ON pp.id_persona = u.id_persona
        WHERE c.estado = 'EN_ESPERA'
          AND t.estado IN ('PENDIENTE', 'EN_CURSO')
          AND pl.estado = 'ACTIVO'
          AND u.estado = 'ACTIVO'
          AND UPPER(BTRIM(pl.cargo)) <> 'SECRETARIA'
          AND NOT EXISTS (
            SELECT 1 FROM sesiones se
            WHERE se.id_cita = c.id_cita
              AND se.estado IN ('EN_CURSO', 'FINALIZADA')
          )
        ORDER BY c.fecha_hora_inicio
      `),
      this.db.manager.query(`
        SELECT
          t.id_tratamiento,
          h.id_paciente,
          CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) AS paciente,
          pe.ci,
          s.nombre AS servicio,
          (
            t.sesiones_iniciales + COALESCE((SELECT SUM(a.sesiones_agregadas) FROM ampliaciones_tratamiento a WHERE a.id_tratamiento = t.id_tratamiento), 0)
            - (SELECT COUNT(*) FROM sesiones se WHERE se.id_tratamiento = t.id_tratamiento AND se.estado IN ('EN_CURSO', 'FINALIZADA'))
          )::integer AS sesiones_disponibles
        FROM tratamientos_paciente t
        JOIN historiales h ON h.id_historial = t.id_historial
        JOIN pacientes p ON p.id_paciente = h.id_paciente
        JOIN personas pe ON pe.id_persona = p.id_persona
        JOIN servicios s ON s.id_servicio = t.id_servicio
        WHERE t.estado IN ('PENDIENTE', 'EN_CURSO')
          AND NOT EXISTS (SELECT 1 FROM sesiones se WHERE se.id_tratamiento = t.id_tratamiento AND se.estado = 'EN_CURSO')
          AND (
            t.sesiones_iniciales + COALESCE((SELECT SUM(a.sesiones_agregadas) FROM ampliaciones_tratamiento a WHERE a.id_tratamiento = t.id_tratamiento), 0)
            > (SELECT COUNT(*) FROM sesiones se WHERE se.id_tratamiento = t.id_tratamiento AND se.estado = 'FINALIZADA')
          )
        ORDER BY pe.nombre, pe.ap_paterno, s.nombre
      `),
      this.db.manager.query(`
        SELECT
          pl.id_personal,
          pe.nombre,
          pe.ap_paterno,
          pe.ap_materno,
          pl.cargo,
          pl.color_agenda
        FROM personal pl
        JOIN usuarios u ON u.id_usuario = pl.id_usuario
        JOIN personas pe ON pe.id_persona = u.id_persona
        WHERE pl.estado = 'ACTIVO' AND u.estado = 'ACTIVO'
          AND UPPER(BTRIM(pl.cargo)) <> 'SECRETARIA'
        ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno
      `),
    ]);
    return { appointments, treatments, staff };
  }
  oneSesion(id: number) {
    return this.sesiones.one(id);
  }
  updateSesion(id: number, d: UpdateSesionDto) {
    return this.sesiones.update(id, d);
  }
  async finalizarSesion(id: number) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(Sesion);
      const session = await repository.findOne({
        where: { id_sesion: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) return this.sesiones.one(id, manager);
      if (session.estado !== EstadoSesion.EN_CURSO)
        throw new BadRequestException(
          'Solo se puede finalizar una sesion en curso',
        );
      if (session.id_cita) {
        const rows = (await manager.query(
          `SELECT estado FROM citas WHERE id_cita = $1 FOR UPDATE`,
          [session.id_cita],
        )) as Array<{ estado: EstadoCita }>;
        if (!rows.length || rows[0].estado !== EstadoCita.EN_ESPERA)
          throw new BadRequestException(
            'La cita vinculada ya no se encuentra en espera',
          );
        await manager.query(`UPDATE citas SET estado = $2 WHERE id_cita = $1`, [
          session.id_cita,
          EstadoCita.ATENDIDA,
        ]);
      }
      session.estado = EstadoSesion.FINALIZADA;
      session.finalizada_en = new Date();
      await repository.save(session);
      const acquisitions = await manager.query(`SELECT d.id_adquisicion FROM tratamientos_paciente t JOIN detalles_adquisicion d ON d.id_detalle_adquisicion=t.id_detalle_adquisicion WHERE t.id_tratamiento=$1`, [session.id_tratamiento]) as Array<{ id_adquisicion: number }>;
      if (acquisitions[0]) await completeAcquisition(manager, acquisitions[0].id_adquisicion);
      return session;
    });
  }
  async cancelarSesion(id: number) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(Sesion);
      const session = await repository.findOne({
        where: { id_sesion: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) return this.sesiones.one(id, manager);
      if (session.estado !== EstadoSesion.EN_CURSO)
        throw new BadRequestException(
          'Solo se puede cancelar una sesion en curso',
        );
      if ((await manager.query(`SELECT 1 FROM consumos_sesion WHERE id_sesion=$1 LIMIT 1`, [id])).length) throw new BadRequestException('La sesión ya registra productos consumidos. No la canceles sin resolver esos consumos mediante un ajuste autorizado.');
      session.estado = EstadoSesion.CANCELADA;
      session.finalizada_en = null;
      return repository.save(session);
    });
  }
  createValoracion(d: CreateValoracionDto) {
    this.origin(d);
    return this.db.transaction(async (manager) => {
      await this.ensureActiveStaff(d.id_personal, manager);
      await this.ensureValuationOrigin(manager, d);
      const valuation = await this.valoraciones.create(
        Object.assign({}, d, {
          fecha_valoracion: new Date(d.fecha_valoracion),
        }),
        manager,
      );
      if (d.id_solicitud)
        await manager.query(
          `UPDATE solicitudes_servicio
           SET estado = 'VALORADO'
           WHERE id_solicitud = $1 AND estado = 'PENDIENTE'`,
          [d.id_solicitud],
        );
      return valuation;
    });
  }
  async listValoraciones(q: DomainQueryDto) {
    const { page, limit, search, desde, hasta } = q;
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (q.tipo)
      conditions.push(`v.tipo::text = ${parameter(q.tipo.toUpperCase())}`);
    if (q.id_paciente)
      conditions.push(`h.id_paciente = ${parameter(q.id_paciente)}`);
    if (q.id_personal)
      conditions.push(`v.id_personal = ${parameter(q.id_personal)}`);
    if (q.id_historial)
      conditions.push(`v.id_historial = ${parameter(q.id_historial)}`);
    if (q.id_tratamiento) {
      const treatment = parameter(q.id_tratamiento);
      conditions.push(
        `(v.id_tratamiento = ${treatment} OR ses.id_tratamiento = ${treatment})`,
      );
    }
    if (q.id_sesion) conditions.push(`v.id_sesion = ${parameter(q.id_sesion)}`);
    if (q.id_servicio)
      conditions.push(
        `COALESCE(sol.id_servicio, tr.id_servicio, trs.id_servicio) = ${parameter(q.id_servicio)}`,
      );
    if (desde)
      conditions.push(`v.fecha_valoracion >= ${parameter(desde)}::date`);
    if (hasta)
      conditions.push(
        `v.fecha_valoracion < (${parameter(hasta)}::date + INTERVAL '1 day')`,
      );
    if (search) {
      const value = parameter(`%${search}%`);
      conditions.push(`(
        CONCAT_WS(' ', paciente.nombre, paciente.ap_paterno, paciente.ap_materno) ILIKE ${value}
        OR COALESCE(paciente.ci, '') ILIKE ${value}
        OR COALESCE(servicio.nombre, '') ILIKE ${value}
        OR CONCAT_WS(' ', profesional.nombre, profesional.ap_paterno, profesional.ap_materno) ILIKE ${value}
        OR COALESCE(v.observaciones, '') ILIKE ${value}
      )`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const joins = `
      JOIN historiales h ON h.id_historial = v.id_historial
      JOIN pacientes pac ON pac.id_paciente = h.id_paciente
      JOIN personas paciente ON paciente.id_persona = pac.id_persona
      JOIN personal per ON per.id_personal = v.id_personal
      JOIN usuarios usuario_profesional ON usuario_profesional.id_usuario = per.id_usuario
      JOIN personas profesional ON profesional.id_persona = usuario_profesional.id_persona
      LEFT JOIN solicitudes_servicio sol ON sol.id_solicitud = v.id_solicitud
      LEFT JOIN tratamientos_paciente tr ON tr.id_tratamiento = v.id_tratamiento
      LEFT JOIN sesiones ses ON ses.id_sesion = v.id_sesion
      LEFT JOIN tratamientos_paciente trs ON trs.id_tratamiento = ses.id_tratamiento
      LEFT JOIN servicios servicio
        ON servicio.id_servicio = COALESCE(sol.id_servicio, tr.id_servicio, trs.id_servicio)`;
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM valoraciones v ${joins} ${where}`,
      values,
    )) as Array<{ total: number }>;
    const offset = (page - 1) * limit;
    const limitParameter = parameter(limit);
    const offsetParameter = parameter(offset);
    const data = (await this.db.manager.query(
      `SELECT
         v.id_valoracion, v.id_historial, v.id_solicitud, v.id_tratamiento,
         v.id_sesion, v.id_personal, v.tipo, v.fecha_valoracion,
         v.observaciones, h.id_paciente,
         CONCAT_WS(' ', paciente.nombre, paciente.ap_paterno, paciente.ap_materno) AS paciente,
         paciente.ci,
         COALESCE(sol.id_servicio, tr.id_servicio, trs.id_servicio) AS id_servicio,
         servicio.nombre AS servicio,
         CONCAT_WS(' ', profesional.nombre, profesional.ap_paterno, profesional.ap_materno) AS profesional,
         per.color_agenda,
         CASE
           WHEN v.id_solicitud IS NOT NULL THEN 'SOLICITUD'
           WHEN v.id_tratamiento IS NOT NULL THEN 'TRATAMIENTO'
           WHEN v.id_sesion IS NOT NULL THEN 'SESION'
           ELSE 'INDEPENDIENTE'
         END AS origen,
         COALESCE((
           SELECT jsonb_agg(jsonb_build_object(
             'id_tipo_medida', vm.id_tipo_medida,
             'nombre', tm.nombre,
             'unidad', tm.unidad,
             'valor', vm.valor
           ) ORDER BY tm.nombre)
           FROM valoraciones_medidas vm
           JOIN tipos_medida tm ON tm.id_tipo_medida = vm.id_tipo_medida
           WHERE vm.id_valoracion = v.id_valoracion
         ), '[]'::jsonb) AS medidas
       FROM valoraciones v
       ${joins}
       ${where}
       ORDER BY v.fecha_valoracion DESC, v.id_valoracion DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values,
    )) as unknown[];
    return { data, total: Number(count?.total ?? 0), page, limit };
  }
  async opcionesValoraciones() {
    const [
      patients,
      staff,
      requests,
      treatments,
      sessions,
      measureTypes,
      serviceMeasures,
    ] = await Promise.all([
      this.db.manager.query(`
          SELECT h.id_historial, p.id_paciente, pe.nombre, pe.ap_paterno,
                 pe.ap_materno, pe.ci
          FROM historiales h
          JOIN pacientes p ON p.id_paciente = h.id_paciente
          JOIN personas pe ON pe.id_persona = p.id_persona
          WHERE h.estado = 'ACTIVO' AND p.estado = 'ACTIVO'
          ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno`),
      this.db.manager.query(`
          SELECT per.id_personal, pe.nombre, pe.ap_paterno, pe.ap_materno,
                 per.cargo, per.profesion, per.color_agenda
          FROM personal per
          JOIN usuarios u ON u.id_usuario = per.id_usuario
          JOIN personas pe ON pe.id_persona = u.id_persona
          WHERE per.estado = 'ACTIVO'
            AND UPPER(BTRIM(per.cargo)) <> 'SECRETARIA'
          ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno`),
      this.db.manager.query(`
          SELECT sol.id_solicitud, sol.id_historial, h.id_paciente,
                 sol.id_servicio, s.nombre AS servicio, sol.estado,
                 CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) AS paciente
          FROM solicitudes_servicio sol
          JOIN historiales h ON h.id_historial = sol.id_historial
          JOIN pacientes p ON p.id_paciente = h.id_paciente
          JOIN personas pe ON pe.id_persona = p.id_persona
          JOIN servicios s ON s.id_servicio = sol.id_servicio
          WHERE h.estado = 'ACTIVO' AND p.estado = 'ACTIVO'
            AND sol.estado <> 'DESCARTADO'
          ORDER BY sol.fecha_solicitud DESC`),
      this.db.manager.query(`
          SELECT tr.id_tratamiento, tr.id_historial, h.id_paciente,
                 tr.id_servicio, s.nombre AS servicio, tr.estado,
                 CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) AS paciente
          FROM tratamientos_paciente tr
          JOIN historiales h ON h.id_historial = tr.id_historial
          JOIN pacientes p ON p.id_paciente = h.id_paciente
          JOIN personas pe ON pe.id_persona = p.id_persona
          JOIN servicios s ON s.id_servicio = tr.id_servicio
          WHERE h.estado = 'ACTIVO' AND p.estado = 'ACTIVO'
            AND tr.estado <> 'CANCELADO'
          ORDER BY tr.id_tratamiento DESC`),
      this.db.manager.query(`
          SELECT ses.id_sesion, tr.id_tratamiento, tr.id_historial,
                 h.id_paciente, tr.id_servicio, s.nombre AS servicio,
                 ses.estado, ses.fecha_sesion,
                 CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) AS paciente
          FROM sesiones ses
          JOIN tratamientos_paciente tr ON tr.id_tratamiento = ses.id_tratamiento
          JOIN historiales h ON h.id_historial = tr.id_historial
          JOIN pacientes p ON p.id_paciente = h.id_paciente
          JOIN personas pe ON pe.id_persona = p.id_persona
          JOIN servicios s ON s.id_servicio = tr.id_servicio
          WHERE h.estado = 'ACTIVO' AND p.estado = 'ACTIVO'
            AND ses.estado IN ('EN_CURSO', 'FINALIZADA')
          ORDER BY ses.fecha_sesion DESC`),
      this.db.manager.query(`
          SELECT id_tipo_medida, nombre, unidad
          FROM tipos_medida
          WHERE estado = 'ACTIVO'
          ORDER BY nombre`),
      this.db.manager.query(`
          SELECT sm.id_servicio, sm.id_tipo_medida, sm.obligatorio
          FROM servicios_medidas sm
          JOIN tipos_medida tm ON tm.id_tipo_medida = sm.id_tipo_medida
          WHERE tm.estado = 'ACTIVO'
          ORDER BY sm.id_servicio, tm.nombre`),
    ]);
    return {
      patients,
      staff,
      requests,
      treatments,
      sessions,
      measureTypes,
      serviceMeasures,
    };
  }
  oneValoracion(id: number) {
    return this.valoraciones.one(id);
  }
  updateValoracion(id: number, d: UpdateValoracionDto) {
    return this.valoraciones.update(id, d);
  }
  async setMedida(id: number, d: RegistrarMedidaDto) {
    await this.valoraciones.one(id);
    const allowed = (await this.db.manager.query(
      `SELECT 1
       FROM valoraciones v
       LEFT JOIN solicitudes_servicio so ON so.id_solicitud = v.id_solicitud
       LEFT JOIN tratamientos_paciente tr ON tr.id_tratamiento = v.id_tratamiento
       LEFT JOIN sesiones se ON se.id_sesion = v.id_sesion
       LEFT JOIN tratamientos_paciente trs ON trs.id_tratamiento = se.id_tratamiento
       JOIN tipos_medida tm ON tm.id_tipo_medida = $2 AND tm.estado = 'ACTIVO'
       LEFT JOIN servicios_medidas sm
         ON sm.id_tipo_medida = tm.id_tipo_medida
        AND sm.id_servicio = COALESCE(so.id_servicio,tr.id_servicio,trs.id_servicio)
       WHERE v.id_valoracion = $1
         AND (COALESCE(so.id_servicio,tr.id_servicio,trs.id_servicio) IS NULL
              OR sm.id_servicio IS NOT NULL)`,
      [id, d.id_tipo_medida],
    )) as unknown[];
    if (!allowed.length)
      throw new BadRequestException(
        'El tipo de medida no esta configurado para el servicio valorado',
      );
    const r = this.db.getRepository(ValoracionMedida);
    const current = await r.findOneBy({
      id_valoracion: id,
      id_tipo_medida: d.id_tipo_medida,
    });
    return r.save(
      r.create(Object.assign({}, current, d, { id_valoracion: id })),
    );
  }
  async medidas(id: number) {
    await this.valoraciones.one(id);
    return this.db.getRepository(ValoracionMedida).find({
      where: { id_valoracion: id },
      relations: { tipo_medida: true },
      order: { id_tipo_medida: 'ASC' },
    });
  }
  async setMedidas(id: number, medidas: RegistrarMedidaDto[]) {
    return this.db.transaction(async (manager) => {
      await this.valoraciones.one(id, manager);
      const repository = manager.getRepository(ValoracionMedida);
      for (const medida of medidas) {
        const allowed = (await manager.query(
          `SELECT 1
           FROM valoraciones v
           LEFT JOIN solicitudes_servicio so ON so.id_solicitud = v.id_solicitud
           LEFT JOIN tratamientos_paciente tr ON tr.id_tratamiento = v.id_tratamiento
           LEFT JOIN sesiones se ON se.id_sesion = v.id_sesion
           LEFT JOIN tratamientos_paciente trs ON trs.id_tratamiento = se.id_tratamiento
           JOIN tipos_medida tm
             ON tm.id_tipo_medida = $2 AND tm.estado = 'ACTIVO'
           LEFT JOIN servicios_medidas sm
             ON sm.id_tipo_medida = tm.id_tipo_medida
            AND sm.id_servicio = COALESCE(so.id_servicio,tr.id_servicio,trs.id_servicio)
           WHERE v.id_valoracion = $1
             AND (COALESCE(so.id_servicio,tr.id_servicio,trs.id_servicio) IS NULL
                  OR sm.id_servicio IS NOT NULL)`,
          [id, medida.id_tipo_medida],
        )) as unknown[];
        if (!allowed.length)
          throw new BadRequestException(
            'Uno de los tipos de medida no esta configurado para el servicio valorado',
          );
        const current = await repository.findOneBy({
          id_valoracion: id,
          id_tipo_medida: medida.id_tipo_medida,
        });
        await repository.save(
          repository.create(
            Object.assign({}, current, medida, { id_valoracion: id }),
          ),
        );
      }
      return repository.find({
        where: { id_valoracion: id },
        relations: { tipo_medida: true },
        order: { id_tipo_medida: 'ASC' },
      });
    });
  }
  private origin(d: Partial<CreateValoracionDto>) {
    if (
      [d.id_solicitud, d.id_tratamiento, d.id_sesion].filter(Boolean).length > 1
    )
      throw new BadRequestException('La valoracion solo puede tener un origen');
  }
  private async resolveTreatmentHistory(
    patientId: number | undefined,
    historyId: number | undefined,
    manager: EntityManager,
  ) {
    if (!patientId && !historyId)
      throw new BadRequestException('Debe seleccionar un paciente');

    if (!patientId) return historyId as number;

    const [patient] = (await manager.query(
      `SELECT p.id_paciente, h.id_historial, h.estado AS estado_historial
       FROM pacientes p
       LEFT JOIN historiales h ON h.id_paciente = p.id_paciente
       WHERE p.id_paciente = $1 AND p.estado = 'ACTIVO'
       FOR UPDATE OF p`,
      [patientId],
    )) as Array<{
      id_paciente: number;
      id_historial: number | null;
      estado_historial: string | null;
    }>;

    if (!patient)
      throw new BadRequestException('El paciente no existe o no esta activo');
    if (patient.id_historial && patient.estado_historial !== 'ACTIVO')
      throw new BadRequestException(
        'El historial clinico del paciente esta cerrado. Debe reabrirlo antes de crear el tratamiento',
      );
    if (patient.id_historial) return patient.id_historial;

    const [created] = (await manager.query(
      `INSERT INTO historiales (id_paciente, estado)
       VALUES ($1, 'ACTIVO')
       RETURNING id_historial`,
      [patientId],
    )) as Array<{ id_historial: number }>;
    return created.id_historial;
  }
  private async ensureHistoryAndService(
    historyId: number,
    serviceId: number,
    manager = this.db.manager,
  ) {
    const [row] = (await manager.query(
      `SELECT 1 FROM historiales h
       JOIN pacientes p ON p.id_paciente = h.id_paciente
       JOIN servicios s ON s.id_servicio = $2
       JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
       JOIN areas a ON a.id_area = c.id_area
       WHERE h.id_historial = $1 AND h.estado = 'ACTIVO'
         AND p.estado = 'ACTIVO' AND s.estado = 'ACTIVO'
         AND c.estado = 'ACTIVO' AND a.estado = 'ACTIVO'`,
      [historyId, serviceId],
    )) as unknown[];
    if (!row)
      throw new BadRequestException(
        'El historial, paciente o servicio no esta activo',
      );
  }
  private async ensureActiveStaff(staffId: number, manager = this.db.manager) {
    const rows = (await manager.query(
      `SELECT 1 FROM personal
       WHERE id_personal = $1
         AND estado = 'ACTIVO'
         AND UPPER(BTRIM(cargo)) <> 'SECRETARIA'`,
      [staffId],
    )) as unknown[];
    if (!rows.length)
      throw new BadRequestException(
        'El personal no esta activo o no realiza atenciones',
      );
  }
  private async ensureAcquisitionCoverage(
    detailId: number,
    historyId: number,
    serviceId: number,
    requested: number,
    manager = this.db.manager,
  ) {
    const [coverage] = (await manager.query(
      `SELECT d.sesiones_incluidas - COALESCE(SUM(t.sesiones_iniciales),0) AS disponibles
       FROM detalles_adquisicion d
       JOIN adquisiciones a ON a.id_adquisicion = d.id_adquisicion
       JOIN historiales h ON h.id_paciente = a.id_paciente
       LEFT JOIN tratamientos_paciente t
         ON t.id_detalle_adquisicion = d.id_detalle_adquisicion
        AND t.estado <> 'CANCELADO'
       WHERE d.id_detalle_adquisicion = $1 AND h.id_historial = $2
         AND d.id_servicio = $3 AND a.estado <> 'CANCELADA'
       GROUP BY d.id_detalle_adquisicion`,
      [detailId, historyId, serviceId],
    )) as Array<{ disponibles: string }>;
    if (!coverage || Number(coverage.disponibles) < requested)
      throw new BadRequestException(
        'El detalle adquirido no cubre las sesiones solicitadas',
      );
  }
  private ensureSolicitudTransition(
    current: EstadoSolicitud,
    next: EstadoSolicitud,
  ) {
    if (current === next) return;
    const transitions: Record<EstadoSolicitud, EstadoSolicitud[]> = {
      [EstadoSolicitud.PENDIENTE]: [
        EstadoSolicitud.VALORADO,
        EstadoSolicitud.ACEPTADO,
        EstadoSolicitud.DESCARTADO,
      ],
      [EstadoSolicitud.VALORADO]: [
        EstadoSolicitud.ACEPTADO,
        EstadoSolicitud.DESCARTADO,
      ],
      [EstadoSolicitud.ACEPTADO]: [],
      [EstadoSolicitud.DESCARTADO]: [],
    };
    if (!transitions[current].includes(next))
      throw new BadRequestException(
        `No se permite cambiar la solicitud de ${current} a ${next}`,
      );
  }
  private ensureTreatmentTransition(
    current: EstadoTratamiento,
    next: EstadoTratamiento,
  ) {
    if (current === next) return;
    const transitions: Record<EstadoTratamiento, EstadoTratamiento[]> = {
      [EstadoTratamiento.PENDIENTE]: [
        EstadoTratamiento.EN_CURSO,
        EstadoTratamiento.CANCELADO,
      ],
      [EstadoTratamiento.EN_CURSO]: [
        EstadoTratamiento.FINALIZADO,
        EstadoTratamiento.CANCELADO,
      ],
      [EstadoTratamiento.FINALIZADO]: [],
      [EstadoTratamiento.CANCELADO]: [],
    };
    if (!transitions[current].includes(next))
      throw new BadRequestException(
        `No se permite cambiar el tratamiento de ${current} a ${next}`,
      );
  }
  private async ensureValuationOrigin(
    manager: EntityManager,
    d: CreateValoracionDto,
  ) {
    const rows = (await manager.query(
      `SELECT 1 FROM historiales h
       WHERE h.id_historial = $1 AND h.estado = 'ACTIVO'
         AND ($2::integer IS NULL OR EXISTS (
           SELECT 1 FROM solicitudes_servicio s
           WHERE s.id_solicitud = $2 AND s.id_historial = h.id_historial))
         AND ($3::integer IS NULL OR EXISTS (
           SELECT 1 FROM tratamientos_paciente t
           WHERE t.id_tratamiento = $3 AND t.id_historial = h.id_historial))
         AND ($4::integer IS NULL OR EXISTS (
           SELECT 1 FROM sesiones se
           JOIN tratamientos_paciente t ON t.id_tratamiento = se.id_tratamiento
           WHERE se.id_sesion = $4 AND t.id_historial = h.id_historial))`,
      [d.id_historial, d.id_solicitud, d.id_tratamiento, d.id_sesion],
    )) as unknown[];
    if (!rows.length)
      throw new BadRequestException(
        'El origen de la valoracion no corresponde al historial',
      );
  }
}
