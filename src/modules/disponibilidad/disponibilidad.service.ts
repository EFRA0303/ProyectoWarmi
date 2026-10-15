import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import { EstadoHorarioExtra } from '../../common/enums/estado-horario-extra.enum.js';
import { Personal } from '../personal/entities/personal.entity.js';
import type { CreateBloqueoPersonalDto } from './dto/create-bloqueo-personal.dto.js';
import type { CreateHorarioExtraDto } from './dto/create-horario-extra.dto.js';
import type { CreateHorarioPersonalDto } from './dto/create-horario-personal.dto.js';
import type { ReplaceHorariosPersonalDto } from './dto/replace-horarios-personal.dto.js';
import type {
  BloqueoPersonalQueryDto,
  HorarioExtraQueryDto,
  HorarioPersonalQueryDto,
} from './dto/disponibilidad-query.dto.js';
import type { UpdateBloqueoPersonalDto } from './dto/update-bloqueo-personal.dto.js';
import type { UpdateHorarioExtraDto } from './dto/update-horario-extra.dto.js';
import type { UpdateHorarioPersonalDto } from './dto/update-horario-personal.dto.js';
import { BloqueoPersonal } from './entities/bloqueo-personal.entity.js';
import { HorarioExtraPersonal } from './entities/horario-extra-personal.entity.js';
import { HorarioPersonal } from './entities/horario-personal.entity.js';

@Injectable()
export class DisponibilidadService {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}

  async options() {
    return this.db.query(`
      SELECT
        pl.id_personal,
        u.id_usuario,
        u.foto_perfil_ruta,
        pe.nombre,
        pe.ap_paterno,
        pe.ap_materno,
        pl.profesion,
        pl.cargo,
        pl.color_agenda,
        pl.estado
      FROM personal pl
      INNER JOIN usuarios u ON u.id_usuario = pl.id_usuario
      INNER JOIN personas pe ON pe.id_persona = u.id_persona
      WHERE UPPER(BTRIM(pl.cargo)) <> 'SECRETARIA'
      ORDER BY pe.nombre, pe.ap_paterno, pe.ap_materno
    `);
  }

  async createHorario(dto: CreateHorarioPersonalDto) {
    this.validateTimeRange(dto.hora_inicio, dto.hora_fin);
    return this.db.transaction(async (manager) => {
      await this.ensureActiveStaff(manager, dto.id_personal);
      await this.ensureHorarioAvailable(
        manager,
        dto.id_personal,
        dto.dia_semana,
        dto.hora_inicio,
        dto.hora_fin,
      );
      const repository = manager.getRepository(HorarioPersonal);
      return repository.save(repository.create(dto));
    });
  }

  async findHorarios(query: HorarioPersonalQueryDto) {
    const { page, limit, id_personal, dia_semana, estado } = query;
    const builder = this.db
      .getRepository(HorarioPersonal)
      .createQueryBuilder('horario')
      .orderBy('horario.id_personal', 'ASC')
      .addOrderBy('horario.dia_semana', 'ASC')
      .addOrderBy('horario.hora_inicio', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (id_personal !== undefined)
      builder.andWhere('horario.id_personal = :id_personal', { id_personal });
    if (dia_semana !== undefined)
      builder.andWhere('horario.dia_semana = :dia_semana', { dia_semana });
    if (estado !== undefined)
      builder.andWhere('horario.estado = :estado', { estado });
    const [data, total] = await builder.getManyAndCount();
    return { data, total, page, limit };
  }

  async findHorario(id: number) {
    const row = await this.db
      .getRepository(HorarioPersonal)
      .findOneBy({ id_horario: id });
    if (!row) throw new NotFoundException('Horario no encontrado');
    return row;
  }

  async updateHorario(id: number, dto: UpdateHorarioPersonalDto) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(HorarioPersonal);
      const row = await repository.findOne({
        where: { id_horario: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Horario no encontrado');
      const day = dto.dia_semana ?? row.dia_semana;
      const start = dto.hora_inicio ?? row.hora_inicio;
      const end = dto.hora_fin ?? row.hora_fin;
      const active = dto.estado ?? row.estado;
      this.validateTimeRange(start, end);
      if (active) {
        await this.ensureActiveStaff(manager, row.id_personal);
        await this.ensureHorarioAvailable(
          manager,
          row.id_personal,
          day,
          start,
          end,
          id,
        );
      }
      return repository.save(repository.merge(row, dto));
    });
  }

  async replaceStaffWeek(
    staffId: number,
    dto: ReplaceHorariosPersonalDto,
  ) {
    return this.db.transaction(async (manager) => {
      await this.ensureActiveStaff(manager, staffId);
      const byDay = new Map<string, Array<{ start: string; end: string }>>();
      for (const range of dto.horarios) {
        this.validateTimeRange(range.hora_inicio, range.hora_fin);
        const ranges = byDay.get(range.dia_semana) ?? [];
        if (
          ranges.some(
            (current) =>
              current.start < range.hora_fin &&
              current.end > range.hora_inicio,
          )
        ) {
          throw new ConflictException(
            `Existen horarios superpuestos para ${range.dia_semana.toLowerCase()}`,
          );
        }
        ranges.push({ start: range.hora_inicio, end: range.hora_fin });
        byDay.set(range.dia_semana, ranges);
      }
      const repository = manager.getRepository(HorarioPersonal);
      await repository.delete({ id_personal: staffId });
      if (!dto.horarios.length) return [];
      return repository.save(
        dto.horarios.map((range) =>
          repository.create({
            id_personal: staffId,
            dia_semana: range.dia_semana,
            hora_inicio: range.hora_inicio,
            hora_fin: range.hora_fin,
            motivo_pausa_anterior: range.motivo_pausa_anterior?.trim() || null,
            estado: true,
          }),
        ),
      );
    });
  }

  async createExtra(dto: CreateHorarioExtraDto, actor: number) {
    this.validateTimeRange(dto.hora_inicio, dto.hora_fin);
    return this.db.transaction(async (manager) => {
      await this.ensureActiveStaff(manager, dto.id_personal);
      await this.ensureExtraWithinBusinessHours(
        manager,
        dto.fecha,
        dto.hora_inicio,
        dto.hora_fin,
      );
      await this.ensureExtraAvailable(
        manager,
        dto.id_personal,
        dto.fecha,
        dto.hora_inicio,
        dto.hora_fin,
      );
      const repository = manager.getRepository(HorarioExtraPersonal);
      return repository.save(
        repository.create({
          id_personal: dto.id_personal,
          fecha: dto.fecha,
          hora_inicio: dto.hora_inicio,
          hora_fin: dto.hora_fin,
          motivo: dto.motivo,
          autorizado_por: actor,
        }),
      );
    });
  }

  async findExtras(query: HorarioExtraQueryDto) {
    const { page, limit, id_personal, fecha, estado } = query;
    const builder = this.db
      .getRepository(HorarioExtraPersonal)
      .createQueryBuilder('extra')
      .orderBy('extra.fecha', 'DESC')
      .addOrderBy('extra.hora_inicio', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (id_personal !== undefined)
      builder.andWhere('extra.id_personal = :id_personal', { id_personal });
    if (fecha !== undefined)
      builder.andWhere('extra.fecha = :fecha', { fecha });
    if (estado !== undefined)
      builder.andWhere('extra.estado = :estado', { estado });
    const [data, total] = await builder.getManyAndCount();
    return { data, total, page, limit };
  }

  async findExtra(id: number) {
    const row = await this.db
      .getRepository(HorarioExtraPersonal)
      .findOneBy({ id_horario_extra: id });
    if (!row) throw new NotFoundException('Horario extra no encontrado');
    return row;
  }

  async updateExtra(id: number, dto: UpdateHorarioExtraDto) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(HorarioExtraPersonal);
      const row = await repository.findOne({
        where: { id_horario_extra: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Horario extra no encontrado');
      const date = dto.fecha ?? row.fecha;
      const start = dto.hora_inicio ?? row.hora_inicio;
      const end = dto.hora_fin ?? row.hora_fin;
      const state = dto.estado ?? row.estado;
      this.validateTimeRange(start, end);
      if (state === EstadoHorarioExtra.AUTORIZADO) {
        await this.ensureActiveStaff(manager, row.id_personal);
        await this.ensureExtraWithinBusinessHours(manager, date, start, end);
        await this.ensureExtraAvailable(
          manager,
          row.id_personal,
          date,
          start,
          end,
          id,
        );
      }
      return repository.save(repository.merge(row, dto));
    });
  }

  async createBlock(dto: CreateBloqueoPersonalDto) {
    const start = new Date(dto.fecha_hora_inicio);
    const end = new Date(dto.fecha_hora_fin);
    this.validateDateRange(start, end);
    return this.db.transaction(async (manager) => {
      await this.ensureActiveStaff(manager, dto.id_personal);
      await this.ensureBlockAvailable(manager, dto.id_personal, start, end);
      const repository = manager.getRepository(BloqueoPersonal);
      return repository.save(
        repository.create({
          id_personal: dto.id_personal,
          fecha_hora_inicio: start,
          fecha_hora_fin: end,
          motivo: dto.motivo,
        }),
      );
    });
  }

  async findBlocks(query: BloqueoPersonalQueryDto) {
    const { page, limit, id_personal, estado } = query;
    const builder = this.db
      .getRepository(BloqueoPersonal)
      .createQueryBuilder('bloqueo')
      .orderBy('bloqueo.fecha_hora_inicio', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    if (id_personal !== undefined)
      builder.andWhere('bloqueo.id_personal = :id_personal', { id_personal });
    if (estado !== undefined)
      builder.andWhere('bloqueo.estado = :estado', { estado });
    const [data, total] = await builder.getManyAndCount();
    return { data, total, page, limit };
  }

  async findBlock(id: number) {
    const row = await this.db
      .getRepository(BloqueoPersonal)
      .findOneBy({ id_bloqueo: id });
    if (!row) throw new NotFoundException('Bloqueo no encontrado');
    return row;
  }

  async updateBlock(id: number, dto: UpdateBloqueoPersonalDto) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(BloqueoPersonal);
      const row = await repository.findOne({
        where: { id_bloqueo: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Bloqueo no encontrado');
      const start = dto.fecha_hora_inicio
        ? new Date(dto.fecha_hora_inicio)
        : row.fecha_hora_inicio;
      const end = dto.fecha_hora_fin
        ? new Date(dto.fecha_hora_fin)
        : row.fecha_hora_fin;
      this.validateDateRange(start, end);
      const active = dto.estado ?? row.estado;
      if (active) {
        await this.ensureActiveStaff(manager, row.id_personal);
        await this.ensureBlockAvailable(
          manager,
          row.id_personal,
          start,
          end,
          id,
        );
      }
      return repository.save(
        repository.merge(row, {
          fecha_hora_inicio: start,
          fecha_hora_fin: end,
          motivo: dto.motivo,
          estado: dto.estado,
        }),
      );
    });
  }

  async removeBlock(id: number) {
    const repository = this.db.getRepository(BloqueoPersonal);
    const row = await repository.findOneBy({ id_bloqueo: id });
    if (!row) throw new NotFoundException('Bloqueo no encontrado');
    await repository.remove(row);
    return { id_bloqueo: id, eliminado: true };
  }

  private validateTimeRange(start: string, end: string) {
    if (start >= end)
      throw new BadRequestException('hora_inicio debe ser menor que hora_fin');
  }

  private validateDateRange(start: Date, end: Date) {
    if (start >= end)
      throw new BadRequestException(
        'fecha_hora_inicio debe ser menor que fecha_hora_fin',
      );
  }

  private async ensureActiveStaff(manager: EntityManager, id: number) {
    if (
      !(await manager
        .getRepository(Personal)
        .existsBy({ id_personal: id, estado: EstadoGeneral.ACTIVO }))
    )
      throw new BadRequestException('El personal no existe o esta inactivo');
  }

  private async ensureHorarioAvailable(
    manager: EntityManager,
    staffId: number,
    day: string,
    start: string,
    end: string,
    excludedId?: number,
  ) {
    const builder = manager
      .getRepository(HorarioPersonal)
      .createQueryBuilder('horario')
      .where('horario.id_personal = :staffId', { staffId })
      .andWhere('horario.dia_semana = :day', { day })
      .andWhere('horario.estado = true')
      .andWhere('horario.hora_inicio < :end', { end })
      .andWhere('horario.hora_fin > :start', { start });
    if (excludedId !== undefined)
      builder.andWhere('horario.id_horario != :excludedId', { excludedId });
    if (await builder.getExists())
      throw new ConflictException('El horario se superpone con otro activo');
  }

  private async ensureExtraAvailable(
    manager: EntityManager,
    staffId: number,
    date: string,
    start: string,
    end: string,
    excludedId?: number,
  ) {
    const repository = manager.getRepository(HorarioExtraPersonal);
    const builder = repository
      .createQueryBuilder('extra')
      .where('extra.id_personal = :staffId', { staffId })
      .andWhere('extra.fecha = :date', { date })
      .andWhere('extra.estado = :state', {
        state: EstadoHorarioExtra.AUTORIZADO,
      })
      .andWhere('extra.hora_inicio < :end', { end })
      .andWhere('extra.hora_fin > :start', { start });
    if (excludedId !== undefined)
      builder.andWhere('extra.id_horario_extra != :excludedId', {
        excludedId,
      });
    if (await builder.getExists())
      throw new ConflictException(
        'El horario extra se superpone con otro autorizado',
      );
  }

  private async ensureExtraWithinBusinessHours(
    manager: EntityManager,
    date: string,
    start: string,
    end: string,
  ) {
    const [config] = (await manager.query(`
      SELECT id_configuracion_horario
      FROM configuraciones_horario_atencion
      ORDER BY id_configuracion_horario ASC
      LIMIT 1
    `)) as Array<{ id_configuracion_horario: number }>;
    const weekday = [
      'DOMINGO',
      'LUNES',
      'MARTES',
      'MIERCOLES',
      'JUEVES',
      'VIERNES',
      'SABADO',
    ][new Date(`${date}T12:00:00Z`).getUTCDay()];

    if (!config) {
      const openByDefault = weekday !== 'DOMINGO' && start >= '07:00' && end <= '20:00';
      if (!openByDefault)
        throw new BadRequestException(
          'El horario extraordinario debe estar dentro del horario de atención del spa',
        );
      return;
    }

    const [exception] = (await manager.query(
      `SELECT id_excepcion_horario, tipo, motivo
       FROM excepciones_horario_atencion
       WHERE id_configuracion_horario = $1 AND fecha = $2::date`,
      [config.id_configuracion_horario, date],
    )) as Array<{
      id_excepcion_horario: number;
      tipo: 'CERRADO' | 'HORARIO_ESPECIAL';
      motivo: string | null;
    }>;
    if (exception?.tipo === 'CERRADO')
      throw new BadRequestException(
        exception.motivo
          ? `El spa permanecerá cerrado: ${exception.motivo}`
          : 'El spa permanecerá cerrado en la fecha seleccionada',
      );

    const [, month, day] = date.split('-').map(Number);
    const [holiday] = (await manager.query(
      `SELECT nombre
       FROM feriados
       WHERE id_configuracion_horario = $1
         AND ((tipo = 'DINAMICO' AND fecha = $2::date)
           OR (tipo = 'FIJO' AND mes = $3 AND dia = $4))
       LIMIT 1`,
      [config.id_configuracion_horario, date, month, day],
    )) as Array<{ nombre: string }>;
    if (holiday && exception?.tipo !== 'HORARIO_ESPECIAL')
      throw new BadRequestException(`El spa permanecerá cerrado: ${holiday.nombre}`);

    const ranges = exception?.tipo === 'HORARIO_ESPECIAL'
      ? ((await manager.query(
          `SELECT TO_CHAR(hora_inicio, 'HH24:MI') AS hora_inicio,
                  TO_CHAR(hora_fin, 'HH24:MI') AS hora_fin
           FROM tramos_excepcion_horario_atencion
           WHERE id_excepcion_horario = $1
           ORDER BY hora_inicio`,
          [exception.id_excepcion_horario],
        )) as Array<{ hora_inicio: string; hora_fin: string }>)
      : ((await manager.query(
          `SELECT TO_CHAR(hora_inicio, 'HH24:MI') AS hora_inicio,
                  TO_CHAR(hora_fin, 'HH24:MI') AS hora_fin
           FROM horarios_atencion_semanal
           WHERE id_configuracion_horario = $1 AND dia_semana = $2
           ORDER BY hora_inicio`,
          [config.id_configuracion_horario, weekday],
        )) as Array<{ hora_inicio: string; hora_fin: string }>);
    if (!ranges.some((range) => start >= range.hora_inicio && end <= range.hora_fin))
      throw new BadRequestException(
        ranges.length
          ? `El horario extraordinario debe estar dentro de: ${ranges.map((range) => `${range.hora_inicio}–${range.hora_fin}`).join(' o ')}`
          : 'La fecha seleccionada no tiene horario de atención del spa',
      );
  }

  private async ensureBlockAvailable(
    manager: EntityManager,
    staffId: number,
    start: Date,
    end: Date,
    excludedId?: number,
  ) {
    const builder = manager
      .getRepository(BloqueoPersonal)
      .createQueryBuilder('bloqueo')
      .where('bloqueo.id_personal = :staffId', { staffId })
      .andWhere('bloqueo.estado = true')
      .andWhere('bloqueo.fecha_hora_inicio < :end', { end })
      .andWhere('bloqueo.fecha_hora_fin > :start', { start });
    if (excludedId !== undefined)
      builder.andWhere('bloqueo.id_bloqueo != :excludedId', { excludedId });
    if (await builder.getExists())
      throw new ConflictException('El bloqueo se superpone con otro existente');
  }
}
