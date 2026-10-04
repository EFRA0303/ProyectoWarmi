import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { Rol } from '../../modules/roles/entities/rol.entity.js';
import { Permiso } from '../../modules/permisos/entities/permiso.entity.js';
import { Usuario } from '../../modules/usuarios/entities/usuario.entity.js';
import { RolPermiso } from '../../modules/roles/entities/rol-permiso.entity.js';
import { UsuarioPermiso } from '../../modules/permisos/entities/usuario-permiso.entity.js';

@Injectable()
export class AssignmentsService {
  constructor(@Inject(DataSource) private readonly db: DataSource) {}
  async forRole(id: number) {
    if (!(await this.db.getRepository(Rol).existsBy({ id_rol: id })))
      throw new NotFoundException();
    return this.db
      .getRepository(RolPermiso)
      .find({ where: { id_rol: id }, relations: { permiso: true } });
  }
  async forUser(id: number) {
    if (!(await this.db.getRepository(Usuario).existsBy({ id_usuario: id })))
      throw new NotFoundException();
    return this.db
      .getRepository(UsuarioPermiso)
      .find({ where: { id_usuario: id }, relations: { permiso: true } });
  }
  async role(id: number, permission: number, actor: number) {
    return this.db.transaction(async (manager) => {
      const role = await manager.getRepository(Rol).findOneBy({ id_rol: id });
      const perm = await manager
        .getRepository(Permiso)
        .findOneBy({ id_permiso: permission });
      if (role?.estado !== 'ACTIVO' || perm?.estado !== 'ACTIVO')
        throw new BadRequestException('Rol o permiso inexistente/inactivo');
      const repo = manager.getRepository(RolPermiso);
      const current = await repo.findOneBy({
        id_rol: id,
        id_permiso: permission,
      });
      if (current) return current;
      return repo.save(
        repo.create({ id_rol: id, id_permiso: permission, created_by: actor }),
      );
    });
  }
  async syncRole(id: number, permissions: number[], actor: number) {
    return this.db.transaction(async (manager) => {
      const role = await manager.getRepository(Rol).findOneBy({ id_rol: id });
      if (role?.estado !== 'ACTIVO')
        throw new BadRequestException('Rol inexistente o inactivo');
      const uniqueIds = [...new Set(permissions)];
      const active = uniqueIds.length
        ? await manager
            .getRepository(Permiso)
            .findBy({ id_permiso: In(uniqueIds) })
        : [];
      if (
        active.length !== uniqueIds.length ||
        active.some((permission) => permission.estado !== 'ACTIVO')
      )
        throw new BadRequestException(
          'Uno o mas permisos no existen o estan inactivos',
        );

      const repo = manager.getRepository(RolPermiso);
      const current = await repo.findBy({ id_rol: id });
      const desired = new Set(uniqueIds);
      const currentIds = new Set(current.map((item) => item.id_permiso));
      const removed = current.filter((item) => !desired.has(item.id_permiso));
      if (removed.length) await repo.remove(removed);
      const added = uniqueIds.filter((permission) => !currentIds.has(permission));
      if (added.length)
        await repo.save(
          added.map((id_permiso) =>
            repo.create({
              id_rol: id,
              id_permiso,
              created_by: actor,
              updated_by: null,
            }),
          ),
        );
      return repo.find({ where: { id_rol: id }, relations: { permiso: true } });
    });
  }
  async user(id: number, permission: number, allowed: boolean, actor: number) {
    return this.db.transaction(async (manager) => {
      const user = await manager
        .getRepository(Usuario)
        .findOneBy({ id_usuario: id });
      const perm = await manager
        .getRepository(Permiso)
        .findOneBy({ id_permiso: permission });
      if (user?.estado !== 'ACTIVO' || perm?.estado !== 'ACTIVO')
        throw new BadRequestException('Usuario o permiso inexistente/inactivo');
      const repo = manager.getRepository(UsuarioPermiso);
      const current = await repo.findOne({
        where: { id_usuario: id, id_permiso: permission },
        lock: { mode: 'pessimistic_write' },
      });
      if (current) {
        current.permitido = allowed;
        current.updated_by = actor;
        return repo.save(current);
      }
      return repo.save(
        repo.create({
          id_usuario: id,
          id_permiso: permission,
          permitido: allowed,
          created_by: actor,
        }),
      );
    });
  }
  async syncUser(
    id: number,
    exceptions: Array<{ id_permiso: number; permitido: boolean }>,
    actor: number,
  ) {
    return this.db.transaction(async (manager) => {
      const user = await manager
        .getRepository(Usuario)
        .findOneBy({ id_usuario: id });
      if (user?.estado !== 'ACTIVO')
        throw new BadRequestException('Usuario inexistente o inactivo');
      const uniqueIds = [...new Set(exceptions.map((item) => item.id_permiso))];
      if (uniqueIds.length !== exceptions.length)
        throw new BadRequestException('No se permiten permisos repetidos');
      const active = uniqueIds.length
        ? await manager
            .getRepository(Permiso)
            .findBy({ id_permiso: In(uniqueIds) })
        : [];
      if (
        active.length !== uniqueIds.length ||
        active.some((permission) => permission.estado !== 'ACTIVO')
      )
        throw new BadRequestException(
          'Uno o mas permisos no existen o estan inactivos',
        );

      const repo = manager.getRepository(UsuarioPermiso);
      const current = await repo.findBy({ id_usuario: id });
      const desired = new Map(
        exceptions.map((item) => [item.id_permiso, item.permitido]),
      );
      const removed = current.filter((item) => !desired.has(item.id_permiso));
      if (removed.length) await repo.remove(removed);
      for (const [id_permiso, permitido] of desired) {
        const existing = current.find((item) => item.id_permiso === id_permiso);
        if (existing) {
          existing.permitido = permitido;
          existing.updated_by = actor;
          await repo.save(existing);
        } else {
          await repo.save(
            repo.create({
              id_usuario: id,
              id_permiso,
              permitido,
              created_by: actor,
              updated_by: null,
            }),
          );
        }
      }
      return repo.find({
        where: { id_usuario: id },
        relations: { permiso: true },
      });
    });
  }
}
