import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import { EstadoPromocion } from '../../common/enums/domain.enums.js';
import type {
  AsignarServicioPaqueteDto,
  AsignarServicioPromocionDto,
  CreatePaqueteDto,
  CreatePromocionDto,
  UpdatePaqueteDto,
  UpdatePromocionDto,
} from './dto/paquetes-promociones.dto.js';
import {
  Paquete,
  PaqueteServicio,
  Promocion,
  PromocionServicio,
} from './entities/comercial.entities.js';

@Injectable()
export class PaquetesPromocionesService {
  private readonly paquetes: DomainResourceService<Paquete>;
  private readonly promociones: DomainResourceService<Promocion>;
  constructor(@Inject(DataSource) private readonly db: DataSource) {
    this.paquetes = new DomainResourceService(
      Paquete,
      'id_paquete',
      db.getRepository(Paquete),
      'Paquete',
    );
    this.promociones = new DomainResourceService(
      Promocion,
      'id_promocion',
      db.getRepository(Promocion),
      'Promocion',
    );
  }
  createPaquete(dto: CreatePaqueteDto) {
    return this.paquetes.create(dto);
  }
  async listPaquetes(query: DomainQueryDto) {
    const { page, limit, estado, search } = query;
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (estado)
      conditions.push(`p.estado::text = ${parameter(estado.toUpperCase())}`);
    if (search) {
      const value = parameter(`%${search}%`);
      conditions.push(`(
        p.nombre ILIKE ${value}
        OR COALESCE(p.descripcion, '') ILIKE ${value}
        OR EXISTS (
          SELECT 1 FROM paquetes_servicios ps
          JOIN servicios s ON s.id_servicio = ps.id_servicio
          WHERE ps.id_paquete = p.id_paquete AND s.nombre ILIKE ${value}
        )
      )`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM paquetes p ${where}`,
      values,
    )) as Array<{ total: number }>;
    const limitParameter = parameter(limit);
    const offsetParameter = parameter((page - 1) * limit);
    const data = (await this.db.manager.query(
      `SELECT p.id_paquete, p.nombre, p.descripcion, p.precio, p.estado,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id_servicio', ps.id_servicio,
                  'servicio', s.nombre,
                  'sesiones_incluidas', ps.sesiones_incluidas,
                  'duracion_minutos', s.duracion_minutos,
                  'categoria', c.nombre,
                  'area', a.nombre
                ) ORDER BY a.nombre, c.nombre, s.nombre)
                FROM paquetes_servicios ps
                JOIN servicios s ON s.id_servicio = ps.id_servicio
                JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
                JOIN areas a ON a.id_area = c.id_area
                WHERE ps.id_paquete = p.id_paquete
              ), '[]'::jsonb) AS servicios,
              (SELECT COUNT(*)::int FROM adquisiciones ad
               WHERE ad.id_paquete = p.id_paquete) AS adquisiciones
       FROM paquetes p
       ${where}
       ORDER BY p.estado ASC, p.nombre ASC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values,
    )) as unknown[];
    return { data, total: Number(count?.total ?? 0), page, limit };
  }
  async opcionesPaquetes() {
    const services = await this.db.manager.query(`
      SELECT s.id_servicio, s.nombre, s.descripcion, s.duracion_minutos,
             s.requiere_valoracion, c.nombre AS categoria, a.nombre AS area
      FROM servicios s
      JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
      JOIN areas a ON a.id_area = c.id_area
      WHERE s.estado = 'ACTIVO' AND c.estado = 'ACTIVO' AND a.estado = 'ACTIVO'
      ORDER BY a.nombre, c.nombre, s.nombre
    `);
    return { services };
  }
  getPaquete(id: number) {
    return this.paquetes.one(id);
  }
  updatePaquete(id: number, dto: UpdatePaqueteDto) {
    return this.paquetes.update(id, dto);
  }

  async assignPaqueteService(id: number, dto: AsignarServicioPaqueteDto) {
    await this.paquetes.one(id);
    await this.ensureService(dto.id_servicio);
    const repository = this.db.getRepository(PaqueteServicio);
    const current = await repository.findOneBy({
      id_paquete: id,
      id_servicio: dto.id_servicio,
    });
    return repository.save(
      repository.create(Object.assign({}, current, dto, { id_paquete: id })),
    );
  }
  async listPaqueteServices(id: number) {
    await this.paquetes.one(id);
    return this.db.getRepository(PaqueteServicio).find({
      where: { id_paquete: id },
      relations: { servicio: true },
      order: { id_servicio: 'ASC' },
    });
  }
  async assignPaqueteServices(
    id: number,
    services: AsignarServicioPaqueteDto[],
  ) {
    return this.db.transaction(async (manager) => {
      await this.paquetes.one(id, manager);
      const repository = manager.getRepository(PaqueteServicio);
      const seen = new Set<number>();
      for (const service of services) {
        if (seen.has(service.id_servicio))
          throw new BadRequestException(
            'No se puede repetir un servicio dentro del paquete',
          );
        seen.add(service.id_servicio);
        const active = (await manager.query(
          `SELECT 1 FROM servicios s
           JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
           JOIN areas a ON a.id_area = c.id_area
           WHERE s.id_servicio = $1 AND s.estado = 'ACTIVO'
             AND c.estado = 'ACTIVO' AND a.estado = 'ACTIVO'`,
          [service.id_servicio],
        )) as unknown[];
        if (!active.length)
          throw new NotFoundException('Servicio no encontrado');
        const current = await repository.findOneBy({
          id_paquete: id,
          id_servicio: service.id_servicio,
        });
        await repository.save(
          repository.create(
            Object.assign({}, current, service, { id_paquete: id }),
          ),
        );
      }
      return repository.find({
        where: { id_paquete: id },
        relations: { servicio: true },
        order: { id_servicio: 'ASC' },
      });
    });
  }

  createPromocion(dto: CreatePromocionDto) {
    this.ensureDates(dto.fecha_inicio, dto.fecha_fin);
    return this.promociones.create(
      Object.assign({}, dto, {
        fecha_inicio: new Date(dto.fecha_inicio),
        fecha_fin: new Date(dto.fecha_fin),
        estado: EstadoPromocion.PROGRAMADA,
      }),
    );
  }
  async listPromociones(query: DomainQueryDto) {
    const { page, limit, estado, search } = query;
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => {
      values.push(value);
      return `$${values.length}`;
    };
    if (estado)
      conditions.push(`p.estado::text = ${parameter(estado.toUpperCase())}`);
    if (search) {
      const value = parameter(`%${search}%`);
      conditions.push(`(
        p.nombre ILIKE ${value}
        OR COALESCE(p.descripcion, '') ILIKE ${value}
        OR EXISTS (
          SELECT 1 FROM promociones_servicios ps
          JOIN servicios s ON s.id_servicio = ps.id_servicio
          WHERE ps.id_promocion = p.id_promocion AND s.nombre ILIKE ${value}
        )
      )`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [count] = (await this.db.manager.query(
      `SELECT COUNT(*)::int AS total FROM promociones p ${where}`,
      values,
    )) as Array<{ total: number }>;
    const limitParameter = parameter(limit);
    const offsetParameter = parameter((page - 1) * limit);
    const data = (await this.db.manager.query(
      `SELECT p.id_promocion, p.nombre, p.descripcion, p.tipo_descuento,
              p.valor_descuento, p.fecha_inicio, p.fecha_fin, p.estado,
              COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                  'id_servicio', ps.id_servicio,
                  'servicio', s.nombre,
                  'sesiones_incluidas', ps.sesiones_incluidas,
                  'duracion_minutos', s.duracion_minutos,
                  'categoria', c.nombre,
                  'area', a.nombre
                ) ORDER BY a.nombre, c.nombre, s.nombre)
                FROM promociones_servicios ps
                JOIN servicios s ON s.id_servicio = ps.id_servicio
                JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
                JOIN areas a ON a.id_area = c.id_area
                WHERE ps.id_promocion = p.id_promocion
              ), '[]'::jsonb) AS servicios,
              (SELECT COUNT(*)::int FROM adquisiciones ad
               WHERE ad.id_promocion = p.id_promocion) AS adquisiciones
       FROM promociones p
       ${where}
       ORDER BY p.fecha_inicio DESC, p.id_promocion DESC
       LIMIT ${limitParameter} OFFSET ${offsetParameter}`,
      values,
    )) as unknown[];
    return { data, total: Number(count?.total ?? 0), page, limit };
  }
  async opcionesPromociones() {
    return this.opcionesPaquetes();
  }
  getPromocion(id: number) {
    return this.promociones.one(id);
  }
  async updatePromocion(id: number, dto: UpdatePromocionDto) {
    const current = await this.promociones.one(id);
    if (
      [EstadoPromocion.FINALIZADA, EstadoPromocion.CANCELADA].includes(
        current.estado,
      )
    )
      throw new BadRequestException(
        'Una promocion finalizada o cancelada no puede modificarse',
      );
    if (dto.estado) this.ensurePromotionTransition(current.estado, dto.estado);
    if (
      current.estado === EstadoPromocion.ACTIVA &&
      [
        dto.tipo_descuento,
        dto.valor_descuento,
        dto.fecha_inicio,
        dto.fecha_fin,
      ].some((value) => value !== undefined)
    )
      throw new BadRequestException(
        'No se pueden cambiar importes o fechas de una promocion activa',
      );
    this.ensureDates(
      dto.fecha_inicio ?? current.fecha_inicio,
      dto.fecha_fin ?? current.fecha_fin,
    );
    return this.promociones.update(
      id,
      Object.assign({}, dto, {
        ...(dto.fecha_inicio
          ? { fecha_inicio: new Date(dto.fecha_inicio) }
          : {}),
        ...(dto.fecha_fin ? { fecha_fin: new Date(dto.fecha_fin) } : {}),
      }),
    );
  }
  async assignPromocionService(id: number, dto: AsignarServicioPromocionDto) {
    await this.promociones.one(id);
    await this.ensureService(dto.id_servicio);
    const repository = this.db.getRepository(PromocionServicio);
    const current = await repository.findOneBy({
      id_promocion: id,
      id_servicio: dto.id_servicio,
    });
    return repository.save(
      repository.create(Object.assign({}, current, dto, { id_promocion: id })),
    );
  }
  async listPromocionServices(id: number) {
    await this.promociones.one(id);
    return this.db.getRepository(PromocionServicio).find({
      where: { id_promocion: id },
      relations: { servicio: true },
      order: { id_servicio: 'ASC' },
    });
  }
  async assignPromocionServices(
    id: number,
    services: AsignarServicioPromocionDto[],
  ) {
    return this.db.transaction(async (manager) => {
      const promotion = await this.promociones.one(id, manager);
      if (
        [EstadoPromocion.FINALIZADA, EstadoPromocion.CANCELADA].includes(
          promotion.estado,
        )
      )
        throw new BadRequestException(
          'Una promocion finalizada o cancelada no puede modificarse',
        );
      const repository = manager.getRepository(PromocionServicio);
      const seen = new Set<number>();
      for (const service of services) {
        if (seen.has(service.id_servicio))
          throw new BadRequestException(
            'No se puede repetir un servicio dentro de la promocion',
          );
        seen.add(service.id_servicio);
        const active = (await manager.query(
          `SELECT 1 FROM servicios s
           JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
           JOIN areas a ON a.id_area = c.id_area
           WHERE s.id_servicio = $1 AND s.estado = 'ACTIVO'
             AND c.estado = 'ACTIVO' AND a.estado = 'ACTIVO'`,
          [service.id_servicio],
        )) as unknown[];
        if (!active.length)
          throw new NotFoundException('Servicio no encontrado');
        const current = await repository.findOneBy({
          id_promocion: id,
          id_servicio: service.id_servicio,
        });
        await repository.save(
          repository.create(
            Object.assign({}, current, service, { id_promocion: id }),
          ),
        );
      }
      return repository.find({
        where: { id_promocion: id },
        relations: { servicio: true },
        order: { id_servicio: 'ASC' },
      });
    });
  }
  private ensureDates(start: string | Date, end: string | Date) {
    if (new Date(start) >= new Date(end))
      throw new BadRequestException(
        'fecha_inicio debe ser anterior a fecha_fin',
      );
  }
  private async ensureService(id: number) {
    const rows = (await this.db.manager.query(
      `SELECT 1 FROM servicios s
       JOIN categorias_servicio c ON c.id_categoria = s.id_categoria
       JOIN areas a ON a.id_area = c.id_area
       WHERE s.id_servicio = $1 AND s.estado = 'ACTIVO'
         AND c.estado = 'ACTIVO' AND a.estado = 'ACTIVO'`,
      [id],
    )) as unknown[];
    if (!rows.length) throw new NotFoundException('Servicio no encontrado');
  }
  private ensurePromotionTransition(
    current: EstadoPromocion,
    next: EstadoPromocion,
  ) {
    if (current === next) return;
    const transitions: Record<EstadoPromocion, EstadoPromocion[]> = {
      [EstadoPromocion.PROGRAMADA]: [
        EstadoPromocion.ACTIVA,
        EstadoPromocion.CANCELADA,
      ],
      [EstadoPromocion.ACTIVA]: [
        EstadoPromocion.FINALIZADA,
        EstadoPromocion.CANCELADA,
      ],
      [EstadoPromocion.FINALIZADA]: [],
      [EstadoPromocion.CANCELADA]: [],
    };
    if (!transitions[current].includes(next))
      throw new BadRequestException(
        `No se permite cambiar una promocion de ${current} a ${next}`,
      );
  }
}
