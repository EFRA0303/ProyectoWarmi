import { AssignmentsService } from '../../common/utils/assignments.service.js';
import { Module } from '@nestjs/common';
import { RolesService } from './roles.service.js';
import { RolesController } from './roles.controller.js';

@Module({
  controllers: [RolesController],
  providers: [RolesService, AssignmentsService],
})
export class RolesModule {}
