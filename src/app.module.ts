import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { DatabaseExceptionFilter } from './common/filters/database-exception.filter.js';
import { DatabaseModule } from './database/database.module.js';
import { PersonasModule } from './modules/personas/personas.module.js';
import { PacientesModule } from './modules/pacientes/pacientes.module.js';
import { UsuariosModule } from './modules/usuarios/usuarios.module.js';
import { PersonalModule } from './modules/personal/personal.module.js';
import { RolesModule } from './modules/roles/roles.module.js';
import { PermisosModule } from './modules/permisos/permisos.module.js';
import { AccesosUsuarioModule } from './modules/accesos-usuario/accesos-usuario.module.js';
import { AuditoriaModule } from './modules/auditoria/auditoria.module.js';
import { ConfiguracionAuditoriaModule } from './modules/configuracion-auditoria/configuracion-auditoria.module.js';
import { AuthModule } from './modules/auth/auth.module.js';

@Module({
  providers: [{ provide: APP_FILTER, useClass: DatabaseExceptionFilter }],
  imports: [
    DatabaseModule,
    PersonasModule,
    PacientesModule,
    UsuariosModule,
    PersonalModule,
    RolesModule,
    PermisosModule,
    AccesosUsuarioModule,
    AuditoriaModule,
    ConfiguracionAuditoriaModule,
    AuthModule,
  ],
})
export class AppModule {}
