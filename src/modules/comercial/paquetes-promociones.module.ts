import { Module } from '@nestjs/common';
import { PaquetesPromocionesController } from './paquetes-promociones.controller.js';
import { PaquetesPromocionesService } from './paquetes-promociones.service.js';
@Module({
  controllers: [PaquetesPromocionesController],
  providers: [PaquetesPromocionesService],
})
export class PaquetesPromocionesModule {}
