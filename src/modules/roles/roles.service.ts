import {
  BadRequestException,
  Injectable,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, In } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Rol } from './entities/rol.entity.js';
import { Permiso } from '../permisos/entities/permiso.entity.js';
import { RolPermiso } from './entities/rol-permiso.entity.js';
import type { RegistroCompletoRolDto } from './dto/registro-completo-rol.dto.js';

@Injectable()
export class RolesService extends CrudService<Rol> {
  constructor(@Inject(DataSource) private readonly db: DataSource) {
    super(db.getRepository(Rol), 'id_rol');
  }

  async registerComplete(dto: RegistroCompletoRolDto, actor: number) {
    return this.db.transaction(async (manager) => {
      const uniqueIds = [...new Set(dto.id_permisos)];
      const activePermissions = uniqueIds.length
        ? await manager
            .getRepository(Permiso)
            .findBy({ id_permiso: In(uniqueIds) })
        : [];
      if (
        activePermissions.length !== uniqueIds.length ||
        activePermissions.some((permission) => permission.estado !== 'ACTIVO')
      )
        throw new BadRequestException(
          'Uno o mas permisos no existen o estan inactivos',
        );

      const roleRepository = manager.getRepository(Rol);
      const role = await roleRepository.save(
        roleRepository.create({
          nombre: dto.rol.nombre,
          descripcion: dto.rol.descripcion ?? null,
          created_by: actor,
          updated_by: null,
        }),
      );
      if (uniqueIds.length) {
        const assignmentRepository = manager.getRepository(RolPermiso);
        await assignmentRepository.save(
          uniqueIds.map((id_permiso) =>
            assignmentRepository.create({
              id_rol: role.id_rol,
              id_permiso,
              created_by: actor,
              updated_by: null,
            }),
          ),
        );
      }
      return roleRepository.findOneByOrFail({ id_rol: role.id_rol });
    });
  }

  async updateComplete(
    id: number,
    dto: RegistroCompletoRolDto,
    actor: number,
  ) {
    return this.db.transaction(async (manager) => {
      const uniqueIds = [...new Set(dto.id_permisos)];
      const activePermissions = uniqueIds.length
        ? await manager
            .getRepository(Permiso)
            .findBy({ id_permiso: In(uniqueIds) })
        : [];
      if (
        activePermissions.length !== uniqueIds.length ||
        activePermissions.some((permission) => permission.estado !== 'ACTIVO')
      )
        throw new BadRequestException(
          'Uno o mas permisos no existen o estan inactivos',
        );

      const roleRepository = manager.getRepository(Rol);
      const role = await roleRepository.findOne({
        where: { id_rol: id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!role) throw new NotFoundException('Registro no encontrado');
      roleRepository.merge(role, dto.rol, { updated_by: actor });
      await roleRepository.save(role);

      const assignmentRepository = manager.getRepository(RolPermiso);
      const current = await assignmentRepository.findBy({ id_rol: id });
      const desired = new Set(uniqueIds);
      const currentIds = new Set(current.map((item) => item.id_permiso));
      const removed = current.filter((item) => !desired.has(item.id_permiso));
      if (removed.length) await assignmentRepository.remove(removed);
      const added = uniqueIds.filter(
        (permission) => !currentIds.has(permission),
      );
      if (added.length)
        await assignmentRepository.save(
          added.map((id_permiso) =>
            assignmentRepository.create({
              id_rol: id,
              id_permiso,
              created_by: actor,
              updated_by: null,
            }),
          ),
        );
      return roleRepository.findOneByOrFail({ id_rol: id });
    });
  }
}
