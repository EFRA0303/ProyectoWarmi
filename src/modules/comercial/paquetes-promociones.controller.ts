import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { paginatedSchema } from '../../common/swagger/paginated-schema.js';
import { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import {
  AsignarServicioPaqueteDto,
  AsignarServicioPromocionDto,
  AsignarServiciosPaqueteDto,
  AsignarServiciosPromocionDto,
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
  @Post('paquetes')
  @Permissions('comercial.crear')
  @ApiOperation({ summary: 'Crear un paquete comercial' })
  createPackage(@Body() dto: CreatePaqueteDto) {
    return this.service.createPaquete(dto);
  }
  @Get('paquetes')
  @Permissions('comercial.leer')
  @ApiOkResponse({ schema: paginatedSchema(Paquete) })
  @ApiOperation({ summary: 'Listar paquetes con paginación y filtros' })
  listPackages(@Query() query: DomainQueryDto) {
    return this.service.listPaquetes(query);
  }
  @Get('paquetes-opciones')
  @Permissions('comercial.leer')
  @ApiOperation({ summary: 'Listar servicios disponibles para paquetes' })
  packageOptions() {
    return this.service.opcionesPaquetes();
  }
  @Get('paquetes/:id')
  @Permissions('comercial.leer')
  @ApiOperation({ summary: 'Consultar un paquete por ID' })
  getPackage(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPaquete(id);
  }
  @Patch('paquetes/:id')
  @Permissions('comercial.actualizar')
  @ApiOperation({ summary: 'Actualizar los datos o estado de un paquete' })
  updatePackage(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePaqueteDto,
  ) {
    return this.service.updatePaquete(id, dto);
  }
  @Post('paquetes/:id/servicios')
  @Permissions('comercial.actualizar')
  @ApiOperation({ summary: 'Asignar o actualizar un servicio del paquete' })
  assignPackageService(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarServicioPaqueteDto,
  ) {
    return this.service.assignPaqueteService(id, dto);
  }
  @Get('paquetes/:id/servicios')
  @Permissions('comercial.leer')
  @ApiOperation({ summary: 'Listar los servicios incluidos en un paquete' })
  listPackageServices(@Param('id', ParseIntPipe) id: number) {
    return this.service.listPaqueteServices(id);
  }
  @Put('paquetes/:id/servicios')
  @Permissions('comercial.actualizar')
  @ApiOperation({ summary: 'Asignar varios servicios a un paquete' })
  assignPackageServices(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarServiciosPaqueteDto,
  ) {
    return this.service.assignPaqueteServices(id, dto.servicios);
  }
  @Post('promociones')
  @Permissions('comercial.crear')
  @ApiOperation({ summary: 'Crear una promoción en estado PROGRAMADA' })
  createPromotion(@Body() dto: CreatePromocionDto) {
    return this.service.createPromocion(dto);
  }
  @Get('promociones')
  @Permissions('comercial.leer')
  @ApiOkResponse({ schema: paginatedSchema(Promocion) })
  @ApiOperation({ summary: 'Listar promociones con paginación y filtros' })
  listPromotions(@Query() query: DomainQueryDto) {
    return this.service.listPromociones(query);
  }
  @Get('promociones-opciones')
  @Permissions('comercial.leer')
  @ApiOperation({ summary: 'Listar servicios disponibles para promociones' })
  promotionOptions() {
    return this.service.opcionesPromociones();
  }
  @Get('promociones/:id')
  @Permissions('comercial.leer')
  @ApiOperation({ summary: 'Consultar una promoción por ID' })
  getPromotion(@Param('id', ParseIntPipe) id: number) {
    return this.service.getPromocion(id);
  }
  @Patch('promociones/:id')
  @Permissions('comercial.actualizar')
  @ApiOperation({ summary: 'Actualizar o cambiar el estado de una promoción' })
  updatePromotion(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePromocionDto,
  ) {
    return this.service.updatePromocion(id, dto);
  }
  @Post('promociones/:id/servicios')
  @Permissions('comercial.actualizar')
  @ApiOperation({ summary: 'Asignar o actualizar un servicio de la promoción' })
  assignPromotionService(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarServicioPromocionDto,
  ) {
    return this.service.assignPromocionService(id, dto);
  }
  @Get('promociones/:id/servicios')
  @Permissions('comercial.leer')
  @ApiOperation({ summary: 'Listar los servicios incluidos en una promoción' })
  listPromotionServices(@Param('id', ParseIntPipe) id: number) {
    return this.service.listPromocionServices(id);
  }
  @Put('promociones/:id/servicios')
  @Permissions('comercial.actualizar')
  @ApiOperation({ summary: 'Asignar varios servicios a una promoción' })
  assignPromotionServices(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AsignarServiciosPromocionDto,
  ) {
    return this.service.assignPromocionServices(id, dto.servicios);
  }
}
