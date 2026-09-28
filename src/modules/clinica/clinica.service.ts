import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
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
    return this.solicitudes.create(
      Object.assign({}, d, {
        fecha_solicitud: new Date(d.fecha_solicitud),
        estado: EstadoSolicitud.PENDIENTE,
      }),
    );
  }
  listSolicitudes(q: DomainQueryDto) {
    return this.solicitudes.list(q);
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
    await this.ensureHistoryAndService(d.id_historial, d.id_servicio);
    await this.ensureActiveStaff(d.indicado_por);
    if (d.id_detalle_adquisicion)
      await this.ensureAcquisitionCoverage(
        d.id_detalle_adquisicion,
        d.id_historial,
        d.id_servicio,
        d.sesiones_iniciales,
      );
    return this.tratamientos.create(
      Object.assign({}, d, {
        estado: EstadoTratamiento.PENDIENTE,
      }),
    );
  }
  listTratamientos(q: DomainQueryDto) {
    return this.tratamientos.list(q);
  }
  oneTratamiento(id: number) {
    return this.tratamientos.one(id);
  }
  async updateTratamiento(id: number, d: UpdateTratamientoDto) {
    const current = await this.tratamientos.one(id);
    if (d.estado) this.ensureTreatmentTransition(current.estado, d.estado);
    if (d.estado === EstadoTratamiento.FINALIZADO) {
      const [progress] = (await this.db.manager.query(
        `SELECT (SELECT COUNT(*) FROM sesiones s
                 WHERE s.id_tratamiento = t.id_tratamiento)::integer AS realizadas,
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
      const [quota] = (await manager.query(
        `SELECT t.sesiones_iniciales + COALESCE(SUM(a.sesiones_agregadas),0) AS total
         FROM tratamientos_paciente t
         LEFT JOIN ampliaciones_tratamiento a ON a.id_tratamiento = t.id_tratamiento
         WHERE t.id_tratamiento = $1 GROUP BY t.id_tratamiento`,
        [d.id_tratamiento],
      )) as Array<{ total: string }>;
      const used = await manager.getRepository(Sesion).countBy({
        id_tratamiento: d.id_tratamiento,
      });
      if (!quota || used >= Number(quota.total))
        throw new BadRequestException(
          'El tratamiento ya utilizo todas sus sesiones disponibles',
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
          fecha_sesion: new Date(d.fecha_sesion),
        }),
        manager,
      );
      if (treatment.estado === EstadoTratamiento.PENDIENTE) {
        treatment.estado = EstadoTratamiento.EN_CURSO;
        treatment.fecha_inicio ??= d.fecha_sesion.slice(0, 10);
        await manager.getRepository(TratamientoPaciente).save(treatment);
      }
      if (d.id_cita)
        await manager.query(`UPDATE citas SET estado = $2 WHERE id_cita = $1`, [
          d.id_cita,
          EstadoCita.ATENDIDA,
        ]);
      return session;
    });
  }
  listSesiones(q: DomainQueryDto) {
    return this.sesiones.list(q);
  }
  oneSesion(id: number) {
    return this.sesiones.one(id);
  }
  updateSesion(id: number, d: UpdateSesionDto) {
    return this.sesiones.update(id, d);
  }
  createValoracion(d: CreateValoracionDto) {
    this.origin(d);
    return this.db.transaction(async (manager) => {
      await this.ensureActiveStaff(d.id_personal, manager);
      await this.ensureValuationOrigin(manager, d);
      return this.valoraciones.create(
        Object.assign({}, d, {
          fecha_valoracion: new Date(d.fecha_valoracion),
        }),
        manager,
      );
    });
  }
  listValoraciones(q: DomainQueryDto) {
    return this.valoraciones.list(q);
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
  private origin(d: Partial<CreateValoracionDto>) {
    if (
      [d.id_solicitud, d.id_tratamiento, d.id_sesion].filter(Boolean).length > 1
    )
      throw new BadRequestException('La valoracion solo puede tener un origen');
  }
  private async ensureHistoryAndService(historyId: number, serviceId: number) {
    const [row] = (await this.db.manager.query(
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
      `SELECT 1 FROM personal WHERE id_personal = $1 AND estado = 'ACTIVO'`,
      [staffId],
    )) as unknown[];
    if (!rows.length)
      throw new BadRequestException('El personal no esta activo');
  }
  private async ensureAcquisitionCoverage(
    detailId: number,
    historyId: number,
    serviceId: number,
    requested: number,
  ) {
    const [coverage] = (await this.db.manager.query(
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
