import { Module } from '@nestjs/common';
import { EmpresaController } from './empresa.controller.js';
import { EmpresaService } from './empresa.service.js';
@Module({ controllers: [EmpresaController], providers: [EmpresaService] })
export class EmpresaModule {}
