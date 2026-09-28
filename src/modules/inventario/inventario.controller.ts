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
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { paginatedSchema } from '../../common/swagger/paginated-schema.js';
import {
  CreateConsumoDto,
  CreateLoteDto,
  CreateMovimientoDto,
  CreateProductoDto,
  CreateSalidaVentaDto,
  UpdateLoteDto,
  UpdateProductoDto,
  VincularServicioProductoDto,
} from './dto/inventario.dto.js';
import { InventarioService } from './inventario.service.js';
import {
  ConsumoSesion,
  LoteProducto,
  MovimientoInventario,
  Producto,
  SalidaProductoVenta,
} from './entities/inventario.entities.js';
@ApiTags('Inventario')
@ApiBearerAuth('access-token')
@ApiExtraModels(
  Producto,
  LoteProducto,
  MovimientoInventario,
  ConsumoSesion,
  SalidaProductoVenta,
)
@Controller('inventario')
export class InventarioController {
  constructor(@Inject(InventarioService) private s: InventarioService) {}
  @Post('productos') @Permissions('inventario.crear') createProducto(
    @Body() d: CreateProductoDto,
  ) {
    return this.s.createProducto(d);
  }
  @Get('productos')
  @Permissions('inventario.leer')
  @ApiOkResponse({ schema: paginatedSchema(Producto) })
  listProductos(@Query() q: DomainQueryDto) {
    return this.s.listProductos(q);
  }
  @Get('productos/:id') @Permissions('inventario.leer') getProducto(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.oneProducto(id);
  }
  @Patch('productos/:id') @Permissions('inventario.actualizar') updateProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body() x: UpdateProductoDto,
  ) {
    return this.s.updateProducto(id, x);
  }
  @Post('lotes') @Permissions('inventario.crear') createLote(
    @Body() d: CreateLoteDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.s.createLote(d, u.sub);
  }
  @Get('lotes')
  @Permissions('inventario.leer')
  @ApiOkResponse({ schema: paginatedSchema(LoteProducto) })
  listLotes(@Query() q: DomainQueryDto) {
    return this.s.listLotes(q);
  }
  @Get('lotes/:id') @Permissions('inventario.leer') getLote(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.oneLote(id);
  }
  @Patch('lotes/:id') @Permissions('inventario.actualizar') updateLote(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdateLoteDto,
  ) {
    return this.s.updateLote(id, d);
  }
  @Get('lotes/:id/stock') @Permissions('inventario.leer') getStock(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.stock(id);
  }
  @Post('servicios/:id/productos')
  @Permissions('inventario.actualizar')
  linkServiceProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: VincularServicioProductoDto,
  ) {
    return this.s.linkService(id, d);
  }
  @Get('servicios/:id/productos')
  @Permissions('inventario.leer')
  listServiceProducts(@Param('id', ParseIntPipe) id: number) {
    return this.s.listServiceProducts(id);
  }
  @Post('movimientos') @Permissions('inventario.crear') createMovement(
    @Body() d: CreateMovimientoDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.s.createMovement(d, u.sub);
  }
  @Get('movimientos')
  @Permissions('inventario.leer')
  @ApiOkResponse({ schema: paginatedSchema(MovimientoInventario) })
  listMovements(@Query() q: DomainQueryDto) {
    return this.s.listMovements(q);
  }
  @Get('movimientos/:id') @Permissions('inventario.leer') getMovement(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.oneMovement(id);
  }
  @Post('consumos-sesion') @Permissions('inventario.crear') createConsumption(
    @Body() d: CreateConsumoDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.s.createConsumption(d, u.sub);
  }
  @Get('consumos-sesion')
  @Permissions('inventario.leer')
  @ApiOkResponse({ schema: paginatedSchema(ConsumoSesion) })
  listConsumptions(@Query() q: DomainQueryDto) {
    return this.s.listConsumptions(q);
  }
  @Post('salidas-venta') @Permissions('inventario.crear') createSaleOutput(
    @Body() d: CreateSalidaVentaDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.s.createSaleOutput(d, u.sub);
  }
  @Get('salidas-venta')
  @Permissions('inventario.leer')
  @ApiOkResponse({ schema: paginatedSchema(SalidaProductoVenta) })
  listSaleOutputs(@Query() q: DomainQueryDto) {
    return this.s.listSaleOutputs(q);
  }
}
