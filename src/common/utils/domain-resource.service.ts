import { NotFoundException } from '@nestjs/common';
import type {
  DeepPartial,
  EntityManager,
  EntityTarget,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import type { DomainQueryDto } from '../dto/domain-query.dto.js';

export class DomainResourceService<T extends ObjectLiteral> {
  constructor(
    private readonly target: EntityTarget<T>,
    private readonly key: keyof T,
    private readonly repository: Repository<T>,
    private readonly label: string,
  ) {}

  private where(id: number): FindOptionsWhere<T> {
    return { [this.key]: id } as FindOptionsWhere<T>;
  }

  create(data: DeepPartial<T>, manager?: EntityManager) {
    const repository = manager?.getRepository(this.target) ?? this.repository;
    return repository.save(repository.create(data));
  }

  async list(query: DomainQueryDto, filters: Record<string, unknown> = {}) {
    const { page, limit, estado, search, desde, hasta, ...exact } = query;
    if (estado) filters.estado = estado;
    const alias = 'resource';
    const builder = this.repository
      .createQueryBuilder(alias)
      .orderBy(`${alias}.${String(this.key)}`, 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    for (const [field, value] of Object.entries({ ...filters, ...exact })) {
      if (
        value !== undefined &&
        this.repository.metadata.findColumnWithPropertyName(field)
      )
        builder.andWhere(`${alias}.${field} = :${field}`, { [field]: value });
    }
    const textColumn = ['nombre', 'numero_nota', 'nombre_comercial'].find(
      (field) => this.repository.metadata.findColumnWithPropertyName(field),
    );
    if (search && textColumn)
      builder.andWhere(`${alias}.${textColumn} ILIKE :search`, {
        search: `%${search}%`,
      });
    const dateColumn = [
      'fecha_hora_inicio',
      'fecha_movimiento',
      'fecha_emision',
      'fecha_pago',
      'fecha_valoracion',
      'fecha_sesion',
      'fecha_solicitud',
      'fecha_adquisicion',
      'fecha_inicio',
      'fecha_ingreso',
      'programada_para',
    ].find((field) =>
      this.repository.metadata.findColumnWithPropertyName(field),
    );
    if (desde && dateColumn)
      builder.andWhere(`${alias}.${dateColumn} >= :desde`, { desde });
    if (hasta && dateColumn)
      builder.andWhere(`${alias}.${dateColumn} <= :hasta`, { hasta });
    const [data, total] = await builder.getManyAndCount();
    return { data, total, page, limit };
  }

  async one(id: number, manager?: EntityManager) {
    const repository = manager?.getRepository(this.target) ?? this.repository;
    const row = await repository.findOneBy(this.where(id));
    if (!row) throw new NotFoundException(`${this.label} no encontrado`);
    return row;
  }

  async update(id: number, data: DeepPartial<T>) {
    const row = await this.one(id);
    return this.repository.save(this.repository.merge(row, data));
  }
}
