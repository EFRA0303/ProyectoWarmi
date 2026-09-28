import { Module } from '@nestjs/common';
import { AdquisicionesController } from './adquisiciones.controller.js';
import { AdquisicionesService } from './adquisiciones.service.js';
@Module({
  controllers: [AdquisicionesController],
  providers: [AdquisicionesService],
})
export class AdquisicionesModule {}
