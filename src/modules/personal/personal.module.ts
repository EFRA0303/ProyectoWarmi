import { Module } from '@nestjs/common';
import { PersonalService } from './personal.service.js';
import { PersonalController } from './personal.controller.js';

@Module({
  controllers: [PersonalController],
  providers: [PersonalService],
})
export class PersonalModule {}
