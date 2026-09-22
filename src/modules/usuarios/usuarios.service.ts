import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Usuario } from './entities/usuario.entity.js';
import type { DeepPartial } from 'typeorm';
import { Rol } from '../roles/entities/rol.entity.js';
import { EstadoGeneral } from '../../common/enums/estado-general.enum.js';
import type { CreateUsuarioDto } from './dto/create-usuario.dto.js';
import { hashPassword } from '../../common/utils/password.js';

@Injectable()
export class UsuariosService extends CrudService<Usuario> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Usuario), 'id_usuario');
  }

  protected async validate(
    data: DeepPartial<Usuario>,
    actor: number,
    current?: Usuario,
  ) {
    if (
      current?.id_usuario === actor &&
      data.estado &&
      data.estado !== 'ACTIVO'
    )
      throw new BadRequestException('No puedes desactivar tu propia cuenta');
    if (
      data.id_rol &&
      !(await this.repository.manager
        .getRepository(Rol)
        .existsBy({ id_rol: data.id_rol, estado: EstadoGeneral.ACTIVO }))
    )
      throw new BadRequestException('El rol no existe o esta inactivo');
  }
  async register(dto: CreateUsuarioDto, actor: number) {
    return this.create(
      {
        id_persona: dto.id_persona,
        id_rol: dto.id_rol,
        correo_acceso: dto.correo_acceso.toLowerCase(),
        nombre_usuario: dto.nombre_usuario,
        contrasena_hash: await hashPassword(dto.contrasena),
      },
      actor,
    );
  }
}
