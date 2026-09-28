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
  listPaquetes(query: DomainQueryDto) {
    return this.paquetes.list(query);
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
  listPromociones(query: DomainQueryDto) {
    return this.promociones.list(query);
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
