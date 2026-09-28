import { Module } from '@nestjs/common';
import { HistorialesController } from './historiales.controller.js';
import { HistorialesService } from './historiales.service.js';

@Module({
  controllers: [HistorialesController],
  providers: [HistorialesService],
})
export class HistorialesModule {}
