import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import type {
  CreateAdquisicionDto,
  UpdateAdquisicionDto,
} from './dto/adquisicion.dto.js';
import {
  Adquisicion,
  DetalleAdquisicion,
} from './entities/comercial.entities.js';
import { Servicio } from '../catalogo/entities/servicio.entity.js';
import {
  EstadoAdquisicion,
  TipoDescuento,
} from '../../common/enums/domain.enums.js';

@Injectable()
export class AdquisicionesService {
  private readonly resource: DomainResourceService<Adquisicion>;
  constructor(@Inject(DataSource) private readonly db: DataSource) {
    this.resource = new DomainResourceService(
      Adquisicion,
      'id_adquisicion',
      db.getRepository(Adquisicion),
      'Adquisicion',
    );
  }
  async create(dto: CreateAdquisicionDto, actor: number) {
    this.validate(dto);
    return this.db.transaction(async (manager) => {
      const { detalles, ...header } = dto;
      if (!detalles.length)
        throw new BadRequestException(
          'La adquisicion debe contener al menos un detalle',
        );
      const patient = (await manager.query(
        `SELECT 1 FROM pacientes WHERE id_paciente = $1 AND estado = 'ACTIVO'`,
        [header.id_paciente],
      )) as unknown[];
      if (!patient.length)
        throw new BadRequestException('El paciente no esta activo');
      const services = await Promise.all(
        detalles.map(async (item) => {
          const service = await manager
            .getRepository(Servicio)
            .findOneBy({ id_servicio: item.id_servicio });
          if (!service)
            throw new BadRequestException(
              `El servicio ${item.id_servicio} no existe`,
            );
          const gross = Number(item.precio_unitario) * item.sesiones_incluidas;
          const discount = Number(item.descuento ?? 0);
          if (discount > gross)
            throw new BadRequestException(
              `El descuento de ${service.nombre} supera su importe`,
            );
          return Object.assign({}, item, {
            nombre_servicio_snapshot: service.nombre,
            precio_unitario: this.money(Number(item.precio_unitario)),
            descuento: this.money(discount),
            subtotal: this.money(gross - discount),
            gross,
          });
        }),
      );
      await this.validateCommercialOrigin(manager, header, services);
      const detailGross = services.reduce((sum, item) => sum + item.gross, 0);
      let original = detailGross;
      let discount = services.reduce(
        (sum, item) => sum + Number(item.descuento),
        0,
      );
      if (header.id_paquete) {
        const [pkg] = (await manager.query(
          "SELECT precio FROM paquetes WHERE id_paquete = $1 AND estado = 'ACTIVO'",
          [header.id_paquete],
        )) as Array<{ precio: string }>;
        if (!pkg) throw new BadRequestException('El paquete no esta activo');
        original = Number(pkg.precio);
        discount = Number(header.descuento ?? 0);
      } else if (header.id_promocion) {
        const [promotion] = (await manager.query(
          `SELECT tipo_descuento, valor_descuento FROM promociones
           WHERE id_promocion = $1 AND estado = 'ACTIVA'
             AND fecha_inicio <= $2 AND fecha_fin >= $2`,
          [header.id_promocion, header.fecha_adquisicion],
        )) as Array<{
          tipo_descuento: TipoDescuento;
          valor_descuento: string;
        }>;
        if (!promotion)
          throw new BadRequestException('La promocion no esta vigente');
        discount =
          promotion.tipo_descuento === TipoDescuento.PORCENTAJE
            ? original * (Number(promotion.valor_descuento) / 100)
            : Number(promotion.valor_descuento);
      }
      discount = Math.min(discount, original);
      const total = original - discount;
      const acquisition = await this.resource.create(
        Object.assign({}, header, {
          precio_original: this.money(original),
          descuento: this.money(discount),
          total: this.money(total),
          fecha_adquisicion: new Date(header.fecha_adquisicion),
          registrado_por: actor,
          estado: EstadoAdquisicion.ACTIVA,
        }),
        manager,
      );
      const repo = manager.getRepository(DetalleAdquisicion);
      await repo.save(
        services.map(({ gross: _gross, ...item }) =>
          repo.create({ ...item, id_adquisicion: acquisition.id_adquisicion }),
        ),
      );
      return manager.getRepository(Adquisicion).findOne({
        where: { id_adquisicion: acquisition.id_adquisicion },
        relations: { paciente: true },
      });
    });
  }
  async list(query: DomainQueryDto) {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (query.estado) conditions.push(`a.estado::text = ${parameter(query.estado.toUpperCase())}`);
    if (query.id_paciente) conditions.push(`a.id_paciente = ${parameter(query.id_paciente)}`);
    if (query.search) { const value = parameter(`%${query.search}%`); conditions.push(`(pe.nombre ILIKE ${value} OR pe.ap_paterno ILIKE ${value} OR COALESCE(pe.ci, '') ILIKE ${value} OR COALESCE(pq.nombre, pr.nombre, '') ILIKE ${value})`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [count] = (await this.db.manager.query(`SELECT COUNT(*)::int AS total FROM adquisiciones a JOIN pacientes pa ON pa.id_paciente = a.id_paciente JOIN personas pe ON pe.id_persona = pa.id_persona LEFT JOIN paquetes pq ON pq.id_paquete = a.id_paquete LEFT JOIN promociones pr ON pr.id_promocion = a.id_promocion ${where}`, values)) as Array<{ total: number }>;
    const limit = parameter(query.limit); const offset = parameter((query.page - 1) * query.limit);
    const data = await this.db.manager.query(`SELECT a.*, pe.nombre || ' ' || pe.ap_paterno || ' ' || pe.ap_materno AS paciente, pe.ci, COALESCE(pq.nombre, pr.nombre, 'Adquisición directa') AS origen,
      COALESCE((SELECT SUM(d.sesiones_incluidas) FROM detalles_adquisicion d WHERE d.id_adquisicion = a.id_adquisicion),0)::int AS sesiones_incluidas,
      COALESCE((SELECT SUM(t.sesiones_iniciales) FROM detalles_adquisicion d JOIN tratamientos_paciente t ON t.id_detalle_adquisicion = d.id_detalle_adquisicion WHERE d.id_adquisicion = a.id_adquisicion),0)::int AS sesiones_asignadas,
      COALESCE((SELECT COUNT(*) FROM detalles_adquisicion d JOIN tratamientos_paciente t ON t.id_detalle_adquisicion = d.id_detalle_adquisicion JOIN sesiones s ON s.id_tratamiento = t.id_tratamiento WHERE d.id_adquisicion = a.id_adquisicion AND s.estado = 'FINALIZADA'),0)::int AS sesiones_realizadas,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id_detalle_adquisicion',d.id_detalle_adquisicion,'id_servicio',d.id_servicio,'servicio',d.nombre_servicio_snapshot,'sesiones_incluidas',d.sesiones_incluidas,'precio_unitario',d.precio_unitario,'subtotal',d.subtotal) ORDER BY d.id_detalle_adquisicion) FROM detalles_adquisicion d WHERE d.id_adquisicion = a.id_adquisicion),'[]'::jsonb) AS detalles
      FROM adquisiciones a JOIN pacientes pa ON pa.id_paciente = a.id_paciente JOIN personas pe ON pe.id_persona = pa.id_persona LEFT JOIN paquetes pq ON pq.id_paquete = a.id_paquete LEFT JOIN promociones pr ON pr.id_promocion = a.id_promocion ${where} ORDER BY a.fecha_adquisicion DESC, a.id_adquisicion DESC LIMIT ${limit} OFFSET ${offset}`, values);
    return { data, total: Number(count?.total ?? 0), page: query.page, limit: query.limit };
  }
  async one(id: number) {
    await this.resource.one(id);
    return this.db.getRepository(Adquisicion).findOne({
      where: { id_adquisicion: id },
      relations: { paciente: true, paquete: true, promocion: true },
    });
  }
  async update(id: number, dto: UpdateAdquisicionDto) {
    const current = await this.resource.one(id);
    if (current.estado !== EstadoAdquisicion.ACTIVA)
      throw new BadRequestException(
        'Una adquisicion completada o cancelada no puede modificarse',
      );
    if (dto.estado === EstadoAdquisicion.ACTIVA)
      throw new BadRequestException(
        'La adquisicion ya se encuentra en estado ACTIVA',
      );
    return this.resource.update(id, dto);
  }
  async details(id: number) {
    await this.resource.one(id);
    return this.db.getRepository(DetalleAdquisicion).find({
      where: { id_adquisicion: id },
      order: { id_detalle_adquisicion: 'ASC' },
    });
  }
  async options() {
    const [patients, packages, promotions] = await Promise.all([
      this.db.manager.query(`SELECT pa.id_paciente, pe.nombre, pe.ap_paterno, pe.ap_materno, pe.ci FROM pacientes pa JOIN personas pe ON pe.id_persona = pa.id_persona WHERE pa.estado = 'ACTIVO' ORDER BY pe.ap_paterno, pe.nombre`),
      this.db.manager.query(`SELECT p.id_paquete AS id, p.nombre, p.precio, 'PAQUETE' AS tipo, COALESCE(jsonb_agg(jsonb_build_object('id_servicio',ps.id_servicio,'servicio',s.nombre,'sesiones_incluidas',ps.sesiones_incluidas) ORDER BY s.nombre) FILTER (WHERE ps.id_servicio IS NOT NULL),'[]'::jsonb) AS servicios FROM paquetes p LEFT JOIN paquetes_servicios ps ON ps.id_paquete = p.id_paquete LEFT JOIN servicios s ON s.id_servicio = ps.id_servicio WHERE p.estado = 'ACTIVO' GROUP BY p.id_paquete ORDER BY p.nombre`),
      this.db.manager.query(`SELECT p.id_promocion AS id, p.nombre, p.tipo_descuento, p.valor_descuento, 'PROMOCION' AS tipo, COALESCE(jsonb_agg(jsonb_build_object('id_servicio',ps.id_servicio,'servicio',s.nombre,'sesiones_incluidas',ps.sesiones_incluidas) ORDER BY s.nombre) FILTER (WHERE ps.id_servicio IS NOT NULL),'[]'::jsonb) AS servicios FROM promociones p LEFT JOIN promociones_servicios ps ON ps.id_promocion = p.id_promocion LEFT JOIN servicios s ON s.id_servicio = ps.id_servicio WHERE p.estado = 'ACTIVA' AND p.fecha_inicio <= now() AND p.fecha_fin >= now() GROUP BY p.id_promocion ORDER BY p.nombre`),
    ]);
    return { patients, offers: [...packages, ...promotions] };
  }
  private validate(dto: Partial<CreateAdquisicionDto>) {
    if (dto.id_paquete && dto.id_promocion)
      throw new BadRequestException(
        'Una adquisicion no puede tener paquete y promocion al mismo tiempo',
      );
  }
  private async validateCommercialOrigin(
    manager: EntityManager,
    header: Omit<CreateAdquisicionDto, 'detalles'>,
    details: Array<{ id_servicio: number; sesiones_incluidas: number }>,
  ) {
    if (header.id_paquete) {
      const configured = (await manager.query(
        `SELECT id_servicio, sesiones_incluidas FROM paquetes_servicios
         WHERE id_paquete = $1 ORDER BY id_servicio`,
        [header.id_paquete],
      )) as Array<{ id_servicio: number; sesiones_incluidas: number }>;
      if (
        configured.length !== details.length ||
        configured.some(
          (row) =>
            !details.some(
              (detail) =>
                detail.id_servicio === row.id_servicio &&
                detail.sesiones_incluidas === row.sesiones_incluidas,
            ),
        )
      )
        throw new BadRequestException(
          'Los detalles no corresponden a los servicios del paquete',
        );
    }
    if (header.id_promocion) {
      const allowed = (await manager.query(
        `SELECT id_servicio, sesiones_incluidas FROM promociones_servicios
         WHERE id_promocion = $1`,
        [header.id_promocion],
      )) as Array<{ id_servicio: number; sesiones_incluidas: number }>;
      if (
        details.some(
          (detail) =>
            !allowed.some(
              (row) =>
                row.id_servicio === detail.id_servicio &&
                detail.sesiones_incluidas <= row.sesiones_incluidas,
            ),
        )
      )
        throw new BadRequestException(
          'La promocion no aplica a uno de los servicios adquiridos',
        );
    }
  }
  private money(value: number) {
    return value.toFixed(2);
  }
}
