import { Module } from '@nestjs/common';
import { AccesosUsuarioService } from './accesos-usuario.service.js';
import { AccesosUsuarioController } from './accesos-usuario.controller.js';

@Module({
  controllers: [AccesosUsuarioController],
  providers: [AccesosUsuarioService],
})
export class AccesosUsuarioModule {}
