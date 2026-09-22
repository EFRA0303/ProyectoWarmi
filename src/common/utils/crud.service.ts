import { BadRequestException, NotFoundException } from '@nestjs/common';
import type {
  DeepPartial,
  FindOptionsOrder,
  FindOptionsWhere,
  ObjectLiteral,
  Repository,
} from 'typeorm';
import type { PaginationDto } from '../dto/pagination.dto.js';

export class CrudService<T extends ObjectLiteral> {
  constructor(
    protected readonly repository: Repository<T>,
    private readonly key: keyof T,
  ) {}
  protected where(id: number | string): FindOptionsWhere<T> {
    return { [this.key]: id } as FindOptionsWhere<T>;
  }
  protected async validate(
    _data: DeepPartial<T>,
    _actor: number,
    _current?: T,
  ): Promise<void> {}
  async findAll({ page, limit, estado }: PaginationDto) {
    if (
      estado &&
      !this.repository.metadata.findColumnWithPropertyName('estado')
    )
      throw new BadRequestException('Este recurso no tiene estado');
    const [data, total] = await this.repository.findAndCount({
      where: (estado ? { estado } : {}) as FindOptionsWhere<T>,
      order: { [this.key]: 'ASC' } as FindOptionsOrder<T>,
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }
  async findOne(id: number | string) {
    const row = await this.repository.findOneBy(this.where(id));
    if (!row) throw new NotFoundException('Registro no encontrado');
    return row;
  }
  async create(data: DeepPartial<T>, actor: number) {
    await this.validate(data, actor);
    return this.repository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(this.repository.target);
      const row = await repo.save(
        repo.create(
          Object.assign({}, data, { created_by: actor, updated_by: null }),
        ),
      );
      return repo.findOneByOrFail(this.where(row[this.key] as number));
    });
  }
  async update(id: number, data: DeepPartial<T>, actor: number) {
    return this.repository.manager.transaction(async (manager) => {
      const repo = manager.getRepository(this.repository.target);
      const row = await repo.findOne({
        where: this.where(id),
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Registro no encontrado');
      await this.validate(data, actor, row);
      const updated = repo.merge(
        row,
        Object.assign({}, data, { updated_by: actor }),
      );
      await repo.save(updated);
      return repo.findOneByOrFail(this.where(id));
    });
  }
  async deactivate(id: number, actor: number, reason?: string) {
    if (!this.repository.metadata.findColumnWithPropertyName('estado'))
      throw new BadRequestException('Este recurso no tiene estado');
    const data: ObjectLiteral = { estado: 'BAJA' };
    if (reason !== undefined) {
      if (!this.repository.metadata.findColumnWithPropertyName('motivo_baja'))
        throw new BadRequestException('Este recurso no admite motivo_baja');
      data.motivo_baja = reason;
    }
    return this.update(id, data as DeepPartial<T>, actor);
  }
}
