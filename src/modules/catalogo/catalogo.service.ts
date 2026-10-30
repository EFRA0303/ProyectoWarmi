import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import type { CreateAreaDto, UpdateAreaDto } from './dto/area.dto.js';
import type {
  CatalogoQueryDto,
  CategoriaQueryDto,
  ServicioQueryDto,
} from './dto/catalogo-query.dto.js';
import type {
  CreateCategoriaServicioDto,
  UpdateCategoriaServicioDto,
} from './dto/categoria-servicio.dto.js';
import type {
  CreateCategoriaProductoDto,
  UpdateCategoriaProductoDto,
} from './dto/categoria-producto.dto.js';
import type {
  CreateServicioDto,
  UpdateServicioDto,
} from './dto/servicio.dto.js';
import type { AssignServicioMedidaDto } from './dto/servicio-medida.dto.js';
import type {
  CreateTipoMedidaDto,
  UpdateTipoMedidaDto,
} from './dto/tipo-medida.dto.js';
import { Area } from './entities/area.entity.js';
import { CategoriaServicio } from './entities/categoria-servicio.entity.js';
import { CategoriaProducto } from './entities/categoria-producto.entity.js';
import { Servicio } from './entities/servicio.entity.js';
import { ServicioMedida } from './entities/servicio-medida.entity.js';
import { TipoMedida } from './entities/tipo-medida.entity.js';
import {
  Producto,
  ServicioProducto,
} from '../inventario/entities/inventario.entities.js';

@Injectable()
export class CatalogoService {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}

  createArea(dto: CreateAreaDto) {
    const repository = this.db.getRepository(Area);
    return repository.save(repository.create(dto));
  }

  async findAreas({ page, limit, estado }: CatalogoQueryDto) {
    const [data, total] = await this.db.getRepository(Area).findAndCount({
      where: estado ? { estado } : {},
      order: { id_area: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findArea(id: number) {
    const row = await this.db.getRepository(Area).findOneBy({ id_area: id });
    if (!row) throw new NotFoundException('Area no encontrada');
    return row;
  }

  async updateArea(id: number, dto: UpdateAreaDto) {
    const repository = this.db.getRepository(Area);
    const row = await this.findArea(id);
    return repository.save(repository.merge(row, dto));
  }

  createProductCategory(dto: CreateCategoriaProductoDto) {
    const repository = this.db.getRepository(CategoriaProducto);
    return repository.save(repository.create(dto));
  }

  async findProductCategories({ page, limit, estado }: CatalogoQueryDto) {
    const [data, total] = await this.db
      .getRepository(CategoriaProducto)
      .findAndCount({
        where: estado ? { estado } : {},
        order: { nombre: 'ASC' },
        skip: (page - 1) * limit,
        take: limit,
      });
    return { data, total, page, limit };
  }

  async findProductCategory(id: number) {
    const row = await this.db
      .getRepository(CategoriaProducto)
      .findOneBy({ id_categoria_producto: id });
    if (!row)
      throw new NotFoundException('Categoría de producto no encontrada');
    return row;
  }

  async updateProductCategory(id: number, dto: UpdateCategoriaProductoDto) {
    const repository = this.db.getRepository(CategoriaProducto);
    const row = await this.findProductCategory(id);
    return repository.save(repository.merge(row, dto));
  }

  async createCategory(dto: CreateCategoriaServicioDto) {
    await this.ensureActiveArea(this.db.manager, dto.id_area);
    const repository = this.db.getRepository(CategoriaServicio);
    return repository.save(repository.create(dto));
  }

  async findCategories(query: CategoriaQueryDto) {
    const { page, limit, estado, id_area } = query;
    const builder = this.db
      .getRepository(CategoriaServicio)
      .createQueryBuilder('categoria')
      .leftJoinAndSelect('categoria.area', 'area')
      .orderBy('categoria.id_area', 'ASC')
      .addOrderBy('categoria.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (estado) builder.andWhere('categoria.estado = :estado', { estado });
    if (id_area !== undefined)
      builder.andWhere('categoria.id_area = :id_area', { id_area });
    const [data, total] = await builder.getManyAndCount();
    return { data, total, page, limit };
  }

  async findCategory(id: number) {
    const row = await this.db.getRepository(CategoriaServicio).findOne({
      where: { id_categoria: id },
      relations: { area: true },
    });
    if (!row) throw new NotFoundException('Categoria no encontrada');
    return row;
  }

  async updateCategory(id: number, dto: UpdateCategoriaServicioDto) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(CategoriaServicio);
      const row = await repository.findOne({
        where: { id_categoria: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Categoria no encontrada');
      if ((dto.estado ?? row.estado) === EstadoGeneral.ACTIVO)
        await this.ensureActiveArea(manager, dto.id_area ?? row.id_area);
      return repository.save(repository.merge(row, dto));
    });
  }

  async createService(dto: CreateServicioDto) {
    return this.db.transaction(async (manager) => {
      await this.ensureActiveCategory(manager, dto.id_categoria);
      this.validateServicePrice(dto.precio);
      const { medidas, productos, ...values } = dto;
      const repository = manager.getRepository(Servicio);
      const row = await repository.save(repository.create(values));
      await this.saveConfiguration(
        manager,
        row.id_servicio,
        medidas,
        productos,
      );
      return row;
    });
  }

  productOptions() {
    return this.db.getRepository(Producto).find({
      where: { estado: EstadoGeneral.ACTIVO, es_insumo: true },
      select: {
        id_producto: true,
        nombre: true,
        unidad_medida: true,
        estado: true,
      },
      order: { nombre: 'ASC' },
    });
  }

  async findServices(query: ServicioQueryDto) {
    const { page, limit, estado, id_categoria, requiere_valoracion } = query;
    const builder = this.db
      .getRepository(Servicio)
      .createQueryBuilder('servicio')
      .leftJoinAndSelect('servicio.categoria', 'categoria')
      .leftJoinAndSelect('categoria.area', 'area')
      .leftJoinAndSelect('servicio.medidas', 'medida')
      .leftJoinAndSelect('medida.tipoMedida', 'tipoMedida')
      .leftJoinAndSelect('servicio.productos', 'insumo')
      .leftJoinAndSelect('insumo.producto', 'producto')
      .orderBy('servicio.id_categoria', 'ASC')
      .addOrderBy('servicio.nombre', 'ASC')
      .skip((page - 1) * limit)
      .take(limit);
    if (estado) builder.andWhere('servicio.estado = :estado', { estado });
    if (id_categoria !== undefined)
      builder.andWhere('servicio.id_categoria = :id_categoria', {
        id_categoria,
      });
    if (requiere_valoracion !== undefined)
      builder.andWhere('servicio.requiere_valoracion = :requiere_valoracion', {
        requiere_valoracion,
      });
    const [data, total] = await builder.getManyAndCount();
    return { data, total, page, limit };
  }

  async findService(id: number) {
    const row = await this.db.getRepository(Servicio).findOne({
      where: { id_servicio: id },
      relations: {
        categoria: { area: true },
        medidas: { tipoMedida: true },
        productos: { producto: true },
      },
    });
    if (!row) throw new NotFoundException('Servicio no encontrado');
    return row;
  }

  async updateService(id: number, dto: UpdateServicioDto) {
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(Servicio);
      const row = await repository.findOne({
        where: { id_servicio: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!row) throw new NotFoundException('Servicio no encontrado');
      if ((dto.estado ?? row.estado) === EstadoGeneral.ACTIVO)
        await this.ensureActiveCategory(
          manager,
          dto.id_categoria ?? row.id_categoria,
        );
      if (dto.precio !== undefined) this.validateServicePrice(dto.precio);
      const { medidas, productos, ...values } = dto;
      await repository.save(repository.merge(row, values));
      await this.saveConfiguration(manager, id, medidas, productos);
      return row;
    });
  }

  private validateServicePrice(price: string) {
    if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(price))
      throw new BadRequestException(
        'El precio total debe ser un importe no negativo con hasta dos decimales',
      );
  }

  private async saveConfiguration(
    manager: EntityManager,
    serviceId: number,
    measures: CreateServicioDto['medidas'],
    products: CreateServicioDto['productos'],
  ) {
    if (measures !== undefined) {
      if (
        !Array.isArray(measures) ||
        new Set(measures.map((item) => item.id_tipo_medida)).size !==
          measures.length
      )
        throw new BadRequestException(
          'La configuración de mediciones contiene valores repetidos o inválidos',
        );
      const repository = manager.getRepository(ServicioMedida);
      const previous = await repository.findBy({ id_servicio: serviceId });
      const types = measures.length
        ? await manager.getRepository(TipoMedida).findBy({
            id_tipo_medida: In(measures.map((item) => item.id_tipo_medida)),
          })
        : [];
      for (const item of measures) {
        const type = types.find(
          (type) => type.id_tipo_medida === item.id_tipo_medida,
        );
        if (
          !type ||
          (type.estado !== EstadoGeneral.ACTIVO &&
            !previous.some((old) => old.id_tipo_medida === item.id_tipo_medida))
        )
          throw new BadRequestException(
            'Una medición seleccionada no existe o está inactiva',
          );
      }
      await repository.delete({ id_servicio: serviceId });
      if (measures.length)
        await repository.save(
          measures.map((item) =>
            repository.create({
              id_servicio: serviceId,
              id_tipo_medida: item.id_tipo_medida,
              obligatorio: item.obligatorio,
              momentos: item.momentos,
            }),
          ),
        );
    }
    if (products !== undefined) {
      if (
        !Array.isArray(products) ||
        new Set(products.map((item) => item.id_producto)).size !==
          products.length
      )
        throw new BadRequestException(
          'La configuración de productos contiene valores repetidos o inválidos',
        );
      const repository = manager.getRepository(ServicioProducto);
      const previous = await repository.findBy({ id_servicio: serviceId });
      const available = products.length
        ? await manager.getRepository(Producto).findBy({
            id_producto: In(products.map((item) => item.id_producto)),
          })
        : [];
      for (const item of products) {
        const product = available.find(
          (product) => product.id_producto === item.id_producto,
        );
        const preserved = previous.some(
          (old) => old.id_producto === item.id_producto,
        );
        if (
          !product ||
          ((!product.es_insumo || product.estado !== EstadoGeneral.ACTIVO) &&
            !preserved)
        )
          throw new BadRequestException(
            'Un producto seleccionado no es un insumo activo',
          );
        if (
          !/^\d{1,8}(?:\.\d{1,2})?$/.test(item.cantidad_referencial) ||
          Number(item.cantidad_referencial) <= 0
        )
          throw new BadRequestException(
            'La cantidad prevista por sesión debe ser positiva y tener hasta dos decimales',
          );
      }
      await repository.delete({ id_servicio: serviceId });
      if (products.length)
        await repository.save(
          products.map((item) =>
            repository.create({
              id_servicio: serviceId,
              id_producto: item.id_producto,
              cantidad_referencial: item.cantidad_referencial,
            }),
          ),
        );
    }
  }

  createMeasureType(dto: CreateTipoMedidaDto) {
    const repository = this.db.getRepository(TipoMedida);
    return repository.save(repository.create(dto));
  }

  async findMeasureTypes({ page, limit, estado }: CatalogoQueryDto) {
    const [data, total] = await this.db.getRepository(TipoMedida).findAndCount({
      where: estado ? { estado } : {},
      order: { id_tipo_medida: 'ASC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, total, page, limit };
  }

  async findMeasureType(id: number) {
    const row = await this.db
      .getRepository(TipoMedida)
      .findOneBy({ id_tipo_medida: id });
    if (!row) throw new NotFoundException('Tipo de medida no encontrado');
    return row;
  }

  async updateMeasureType(id: number, dto: UpdateTipoMedidaDto) {
    const repository = this.db.getRepository(TipoMedida);
    const row = await this.findMeasureType(id);
    return repository.save(repository.merge(row, dto));
  }

  async assignMeasure(serviceId: number, dto: AssignServicioMedidaDto) {
    return this.db.transaction(async (manager) => {
      await this.ensureActiveService(manager, serviceId);
      if (
        !(await manager.getRepository(TipoMedida).existsBy({
          id_tipo_medida: dto.id_tipo_medida,
          estado: EstadoGeneral.ACTIVO,
        }))
      )
        throw new BadRequestException(
          'El tipo de medida no existe o esta inactivo',
        );
      const repository = manager.getRepository(ServicioMedida);
      const current = await repository.findOneBy({
        id_servicio: serviceId,
        id_tipo_medida: dto.id_tipo_medida,
      });
      if (current) {
        current.obligatorio = dto.obligatorio ?? current.obligatorio;
        current.momentos = dto.momentos ?? current.momentos;
        return repository.save(current);
      }
      return repository.save(
        repository.create({
          id_servicio: serviceId,
          id_tipo_medida: dto.id_tipo_medida,
          obligatorio: dto.obligatorio,
          momentos: dto.momentos,
        }),
      );
    });
  }

  async findServiceMeasures(serviceId: number) {
    if (
      !(await this.db
        .getRepository(Servicio)
        .existsBy({ id_servicio: serviceId }))
    )
      throw new NotFoundException('Servicio no encontrado');
    return this.db.getRepository(ServicioMedida).find({
      where: { id_servicio: serviceId },
      relations: { tipoMedida: true },
      order: { id_tipo_medida: 'ASC' },
    });
  }

  async removeMeasure(serviceId: number, measureId: number) {
    if (
      !(await this.db
        .getRepository(Servicio)
        .existsBy({ id_servicio: serviceId }))
    )
      throw new NotFoundException('Servicio no encontrado');
    const repository = this.db.getRepository(ServicioMedida);
    const relation = await repository.findOneBy({
      id_servicio: serviceId,
      id_tipo_medida: measureId,
    });
    if (!relation)
      throw new NotFoundException('La medida no esta vinculada al servicio');
    await repository.remove(relation);
    return { message: 'Medida desvinculada correctamente' };
  }

  private async ensureActiveArea(manager: EntityManager, id: number) {
    if (
      !(await manager
        .getRepository(Area)
        .existsBy({ id_area: id, estado: EstadoGeneral.ACTIVO }))
    )
      throw new BadRequestException('El area no existe o esta inactiva');
  }

  private async ensureActiveCategory(manager: EntityManager, id: number) {
    const category = await manager.getRepository(CategoriaServicio).findOne({
      where: { id_categoria: id, estado: EstadoGeneral.ACTIVO },
      relations: { area: true },
    });
    if (!category || category.area.estado !== EstadoGeneral.ACTIVO)
      throw new BadRequestException(
        'La categoria no existe o su area esta inactiva',
      );
  }

  private async ensureActiveService(manager: EntityManager, id: number) {
    if (
      !(await manager
        .getRepository(Servicio)
        .existsBy({ id_servicio: id, estado: EstadoGeneral.ACTIVO }))
    )
      throw new BadRequestException('El servicio no existe o esta inactivo');
  }
}
