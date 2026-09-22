import { AssignmentsService } from '../../common/utils/assignments.service.js';
import { Module } from '@nestjs/common';
import { PermisosService } from './permisos.service.js';
import { PermisosController } from './permisos.controller.js';

@Module({
  controllers: [PermisosController],
  providers: [PermisosService, AssignmentsService],
})
export class PermisosModule {}
