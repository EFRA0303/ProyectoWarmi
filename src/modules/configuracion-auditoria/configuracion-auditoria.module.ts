import { Module } from '@nestjs/common';
import { ConfiguracionAuditoriaService } from './configuracion-auditoria.service.js';
import { ConfiguracionAuditoriaController } from './configuracion-auditoria.controller.js';

@Module({
  controllers: [ConfiguracionAuditoriaController],
  providers: [ConfiguracionAuditoriaService],
})
export class ConfiguracionAuditoriaModule {}
