import { Module } from '@nestjs/common';
import { PacientesService } from './pacientes.service.js';
import { PacientesController } from './pacientes.controller.js';

@Module({
  controllers: [PacientesController],
  providers: [PacientesService],
})
export class PacientesModule {}
