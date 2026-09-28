import { Module } from '@nestjs/common';
import { ClinicaController } from './clinica.controller.js';
import { ClinicaService } from './clinica.service.js';
@Module({ controllers: [ClinicaController], providers: [ClinicaService] })
export class ClinicaModule {}
