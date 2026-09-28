import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiTags,
} from '@nestjs/swagger';
import { paginatedSchema } from '../../common/swagger/paginated-schema.js';
import { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import {
  AsignarServicioPaqueteDto,
  AsignarServicioPromocionDto,
  CreatePaqueteDto,
  CreatePromocionDto,
  UpdatePaqueteDto,
  UpdatePromocionDto,
} from './dto/paquetes-promociones.dto.js';
import { PaquetesPromocionesService } from './paquetes-promociones.service.js';
import { Paquete, Promocion } from './entities/comercial.entities.js';

@ApiTags('Paquetes y promociones')
@ApiBearerAuth('access-token')
@ApiExtraModels(Paquete, Promocion)
@Controller('comercial')
export class PaquetesPromocionesController {
  constructor(
    @Inject(PaquetesPromocionesService)
    private readonly service: PaquetesPromocionesService,
  ) {}
  @Post('paquetes') @Permissions('comercial.crear') createPackage(
    @Body() dto: CreatePaqueteDto,
  ) {
    return this.service.createPaquete(dto);
  }
  @Get('paquetes')
  @Permissions('comercial.leer')
  @ApiOkResponse({ schema: paginatedSchema(Paquete) })
  listPackages(@Query() query: DomainQueryDto) {
    return this.service.listPaquetes(query);
  }
  @Get('paquetes/:id') @Permissions('comercial.leer') getPackage(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getPaquete(id);
  }
  @Patch('paquetes/:id') @Permissions('comercial.actualizar') updatePackage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaqueteDto,
  ) {
    return this.service.updatePaquete(id, dto);
  }
  @Post('paquetes/:id/servicios')
  @Permissions('comercial.actualizar')
  assignPackageService(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarServicioPaqueteDto,
  ) {
    return this.service.assignPaqueteService(id, dto);
  }
  @Get('paquetes/:id/servicios')
  @Permissions('comercial.leer')
  listPackageServices(@Param('id', ParseIntPipe) id: number) {
    return this.service.listPaqueteServices(id);
  }
  @Post('promociones') @Permissions('comercial.crear') createPromotion(
    @Body() dto: CreatePromocionDto,
  ) {
    return this.service.createPromocion(dto);
  }
  @Get('promociones')
  @Permissions('comercial.leer')
  @ApiOkResponse({ schema: paginatedSchema(Promocion) })
  listPromotions(@Query() query: DomainQueryDto) {
    return this.service.listPromociones(query);
  }
  @Get('promociones/:id') @Permissions('comercial.leer') getPromotion(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.getPromocion(id);
  }
  @Patch('promociones/:id')
  @Permissions('comercial.actualizar')
  updatePromotion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromocionDto,
  ) {
    return this.service.updatePromocion(id, dto);
  }
  @Post('promociones/:id/servicios')
  @Permissions('comercial.actualizar')
  assignPromotionService(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarServicioPromocionDto,
  ) {
    return this.service.assignPromocionService(id, dto);
  }
  @Get('promociones/:id/servicios')
  @Permissions('comercial.leer')
  listPromotionServices(@Param('id', ParseIntPipe) id: number) {
    return this.service.listPromocionServices(id);
  }
}
