import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import { Paciente } from '../pacientes/entities/paciente.entity.js';
import type { CreateHistorialDto } from './dto/create-historial.dto.js';
import type { HistorialQueryDto } from './dto/historial-query.dto.js';
import type { UpdateHistorialDto } from './dto/update-historial.dto.js';
import { Historial } from './entities/historial.entity.js';

@Injectable()
export class HistorialesService {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}

  async create(dto: CreateHistorialDto) {
    return this.db.transaction(async (manager) => {
      const patient = await manager.getRepository(Paciente).findOneBy({
        id_paciente: dto.id_paciente,
      });
      if (!patient) throw new BadRequestException('El paciente no existe');
      if (patient.estado !== EstadoGeneral.ACTIVO)
        throw new BadRequestException('El paciente no esta activo');

      const repository = manager.getRepository(Historial);
      if (await repository.existsBy({ id_paciente: dto.id_paciente }))
        throw new ConflictException('El paciente ya tiene un historial');

      return repository.save(repository.create(dto));
    });
  }

  async findAll({ page, limit, estado, search, id_paciente }: HistorialQueryDto) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (estado) conditions.push(`h.estado = ${parameter(estado)}`);
    if (id_paciente)
      conditions.push(`h.id_paciente = ${parameter(id_paciente)}`);
    if (search?.trim()) {
      const value = parameter(`%${search.trim()}%`);
      conditions.push(`(
        CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) ILIKE ${value}
        OR COALESCE(pe.ci, '') ILIKE ${value}
        OR pe.telefono1 ILIKE ${value}
        OR COALESCE(u.correo_acceso, '') ILIKE ${value}
        OR COALESCE(h.observaciones_generales, '') ILIKE ${value}
      )`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const joins = `
      JOIN pacientes p ON p.id_paciente = h.id_paciente
      JOIN personas pe ON pe.id_persona = p.id_persona
      LEFT JOIN usuarios u ON u.id_persona = pe.id_persona`;
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM historiales h ${joins} ${where}`,
      values,
    )) as Array<{ total: number }>;
    const limitParameter = parameter(limit);
    const offsetParameter = parameter((page - 1) * limit);
    const data = (await this.db.manager.query(
      `SELECT h.id_historial, h.id_paciente, h.fecha_apertura, h.estado,
              h.observaciones_generales, p.ocupacion, p.estado AS estado_paciente,
              pe.nombre, pe.ap_paterno, pe.ap_materno, pe.ci, pe.fecha_nac,
              pe.genero, pe.telefono1, pe.telefono2, u.id_usuario,
              u.correo_acceso, u.foto_perfil_ruta,
              (SELECT COUNT(*)::int FROM solicitudes_servicio s
               WHERE s.id_historial = h.id_historial) AS solicitudes,
              (SELECT COUNT(*)::int FROM tratamientos_paciente t
               WHERE t.id_historial = h.id_historial) AS tratamientos,
              (SELECT COUNT(*)::int FROM valoraciones v
               WHERE v.id_historial = h.id_historial) AS valoraciones,
              (SELECT COUNT(*)::int FROM sesiones se
               JOIN tratamientos_paciente t ON t.id_tratamiento = se.id_tratamiento
               WHERE t.id_historial = h.id_historial AND se.estado = 'FINALIZADA') AS sesiones_finalizadas,
              GREATEST(
                h.fecha_apertura,
                COALESCE((SELECT MAX(s.fecha_solicitud) FROM solicitudes_servicio s WHERE s.id_historial = h.id_historial), h.fecha_apertura),
                COALESCE((SELECT MAX(v.fecha_valoracion) FROM valoraciones v WHERE v.id_historial = h.id_historial), h.fecha_apertura),
                COALESCE((SELECT MAX(se.fecha_sesion) FROM sesiones se JOIN tratamientos_paciente t ON t.id_tratamiento = se.id_tratamiento WHERE t.id_historial = h.id_historial), h.fecha_apertura)
              ) AS ultima_actividad
       FROM historiales h ${joins} ${where}
       ORDER BY ultima_actividad DESC, h.id_historial DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values,
    )) as unknown[];
    return { data, total: Number(count?.total ?? 0), page, limit };
  }

  async summary(id: number) {
    const [history] = (await this.db.manager.query(
      `SELECT h.id_historial, h.id_paciente, h.fecha_apertura, h.estado,
              h.observaciones_generales, p.ocupacion, p.estado AS estado_paciente,
              pe.nombre, pe.ap_paterno, pe.ap_materno, pe.ci, pe.fecha_nac,
              pe.genero, pe.telefono1, pe.telefono2, pe.direccion,
              u.id_usuario, u.correo_acceso, u.foto_perfil_ruta
       FROM historiales h
       JOIN pacientes p ON p.id_paciente = h.id_paciente
       JOIN personas pe ON pe.id_persona = p.id_persona
       LEFT JOIN usuarios u ON u.id_persona = pe.id_persona
       WHERE h.id_historial = $1`,
      [id],
    )) as Array<Record<string, unknown>>;
    if (!history) throw new NotFoundException('Registro no encontrado');
    const [requests, treatments, sessions, valuations, appointments] =
      await Promise.all([
        this.db.manager.query(
          `SELECT sol.id_solicitud, sol.fecha_solicitud, sol.motivo,
                  sol.estado, s.id_servicio, s.nombre AS servicio
           FROM solicitudes_servicio sol
           JOIN servicios s ON s.id_servicio = sol.id_servicio
           WHERE sol.id_historial = $1
           ORDER BY sol.fecha_solicitud DESC`,
          [id],
        ),
        this.db.manager.query(
          `SELECT t.id_tratamiento, t.fecha_inicio, t.estado, t.observaciones,
                  t.sesiones_iniciales, s.id_servicio, s.nombre AS servicio,
                  CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) AS profesional,
                  COALESCE((SELECT SUM(a.sesiones_agregadas)::int FROM ampliaciones_tratamiento a WHERE a.id_tratamiento = t.id_tratamiento), 0) AS sesiones_agregadas,
                  (SELECT COUNT(*)::int FROM sesiones se WHERE se.id_tratamiento = t.id_tratamiento AND se.estado = 'FINALIZADA') AS sesiones_finalizadas
           FROM tratamientos_paciente t
           JOIN servicios s ON s.id_servicio = t.id_servicio
           JOIN personal per ON per.id_personal = t.indicado_por
           JOIN usuarios u ON u.id_usuario = per.id_usuario
           JOIN personas pe ON pe.id_persona = u.id_persona
           WHERE t.id_historial = $1
           ORDER BY t.id_tratamiento DESC`,
          [id],
        ),
        this.db.manager.query(
          `SELECT se.id_sesion, se.id_tratamiento, se.id_cita, se.fecha_sesion,
                  se.finalizada_en, se.estado, se.observaciones,
                  s.nombre AS servicio,
                  CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) AS profesional
           FROM sesiones se
           JOIN tratamientos_paciente t ON t.id_tratamiento = se.id_tratamiento
           JOIN servicios s ON s.id_servicio = t.id_servicio
           JOIN personal per ON per.id_personal = se.atendido_por
           JOIN usuarios u ON u.id_usuario = per.id_usuario
           JOIN personas pe ON pe.id_persona = u.id_persona
           WHERE t.id_historial = $1
           ORDER BY se.fecha_sesion DESC`,
          [id],
        ),
        this.db.manager.query(
          `SELECT v.id_valoracion, v.tipo, v.fecha_valoracion, v.observaciones,
                  v.id_solicitud, v.id_tratamiento, v.id_sesion,
                  COALESCE(sol_s.nombre, tr_s.nombre, ses_s.nombre) AS servicio,
                  CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) AS profesional,
                  COALESCE((SELECT jsonb_agg(jsonb_build_object(
                    'id_tipo_medida', vm.id_tipo_medida, 'nombre', tm.nombre,
                    'unidad', tm.unidad, 'valor', vm.valor
                  ) ORDER BY tm.nombre)
                  FROM valoraciones_medidas vm
                  JOIN tipos_medida tm ON tm.id_tipo_medida = vm.id_tipo_medida
                  WHERE vm.id_valoracion = v.id_valoracion), '[]'::jsonb) AS medidas
           FROM valoraciones v
           JOIN personal per ON per.id_personal = v.id_personal
           JOIN usuarios u ON u.id_usuario = per.id_usuario
           JOIN personas pe ON pe.id_persona = u.id_persona
           LEFT JOIN solicitudes_servicio sol ON sol.id_solicitud = v.id_solicitud
           LEFT JOIN servicios sol_s ON sol_s.id_servicio = sol.id_servicio
           LEFT JOIN tratamientos_paciente tr ON tr.id_tratamiento = v.id_tratamiento
           LEFT JOIN servicios tr_s ON tr_s.id_servicio = tr.id_servicio
           LEFT JOIN sesiones se ON se.id_sesion = v.id_sesion
           LEFT JOIN tratamientos_paciente ses_t ON ses_t.id_tratamiento = se.id_tratamiento
           LEFT JOIN servicios ses_s ON ses_s.id_servicio = ses_t.id_servicio
           WHERE v.id_historial = $1
           ORDER BY v.fecha_valoracion DESC`,
          [id],
        ),
        this.db.manager.query(
          `SELECT c.id_cita, c.fecha_hora_inicio, c.fecha_hora_fin, c.estado,
                  c.numero_sesion, c.observaciones, s.nombre AS servicio,
                  CONCAT_WS(' ', pe.nombre, pe.ap_paterno, pe.ap_materno) AS profesional
           FROM citas c
           LEFT JOIN tratamientos_paciente t ON t.id_tratamiento = c.id_tratamiento
           LEFT JOIN servicios s ON s.id_servicio = t.id_servicio
           JOIN personal per ON per.id_personal = c.id_personal
           JOIN usuarios u ON u.id_usuario = per.id_usuario
           JOIN personas pe ON pe.id_persona = u.id_persona
           WHERE c.id_paciente = $1
           ORDER BY c.fecha_hora_inicio DESC`,
          [history.id_paciente],
        ),
      ]);
    return { history, requests, treatments, sessions, valuations, appointments };
  }

  options() {
    return this.db.manager.query(`
      SELECT p.id_paciente, pe.nombre, pe.ap_paterno, pe.ap_materno, pe.ci
      FROM pacientes p
      JOIN personas pe ON pe.id_persona = p.id_persona
      LEFT JOIN historiales h ON h.id_paciente = p.id_paciente
      WHERE p.estado = 'ACTIVO' AND h.id_historial IS NULL
      ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno
    `);
  }

  async findOne(id: number) {
    const history = await this.db
      .getRepository(Historial)
      .findOneBy({ id_historial: id });
    if (!history) throw new NotFoundException('Registro no encontrado');
    return history;
  }

  async update(id: number, dto: UpdateHistorialDto) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(Historial);
      const history = await repository.findOne({
        where: { id_historial: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!history) throw new NotFoundException('Registro no encontrado');
      return repository.save(repository.merge(history, dto));
    });
  }
}
