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
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
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
  @Get('opciones')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Listar opciones para la gestión de inventario' })
  options() {
    return this.s.options();
  }
  @Get('operaciones-opciones')
  @Permissions('inventario.leer')
  @ApiOperation({ summary: 'Listar sesiones y ventas pendientes de salida' })
  operationOptions() {
    return this.s.operationOptions();
  }
  @Post('productos')
  @Permissions('inventario.crear')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Crear un producto de inventario' })
  createProducto(@Body() d: CreateProductoDto) {
    return this.s.createProducto(d);
  }
  @Get('productos')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Listar productos de inventario' })
  @ApiOkResponse({ schema: paginatedSchema(Producto) })
  listProductos(@Query() q: DomainQueryDto) {
    return this.s.listProductos(q);
  }
  @Get('productos/:id')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Consultar un producto por ID' })
  getProducto(@Param('id', ParseIntPipe) id: number) {
    return this.s.oneProducto(id);
  }
  @Patch('productos/:id')
  @Permissions('inventario.actualizar')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Actualizar un producto de inventario' })
  updateProducto(
    @Param('id', ParseIntPipe) id: number,
    @Body() x: UpdateProductoDto,
  ) {
    return this.s.updateProducto(id, x);
  }
  @Post('productos/:id/imagen')
  @Permissions('inventario.actualizar')
  @Roles('ROOT', 'ADMINISTRADOR')
  @UseInterceptors(
    FileInterceptor('imagen', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  @ApiOperation({ summary: 'Guardar la imagen WEBP de un producto' })
  uploadProductImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: { buffer: Buffer; size: number } | undefined,
  ) {
    return this.s.saveProductImage(
      id,
      file ?? { buffer: Buffer.alloc(0), size: 0 },
    );
  }
  @Get('productos/:id/imagen')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Obtener la imagen de un producto' })
  async productImage(@Param('id', ParseIntPipe) id: number) {
    const image = await this.s.getProductImage(id);
    return new StreamableFile(image.data, {
      type: image.mime,
      length: image.data.length,
      disposition: 'inline',
    });
  }
  @Post('lotes')
  @Permissions('inventario.crear')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Crear un lote de producto',
    description:
      'Registra el lote y genera automáticamente el movimiento correspondiente a su stock inicial.',
  })
  createLote(@Body() d: CreateLoteDto, @CurrentUser() u: JwtPayload) {
    return this.s.createLote(d, u.sub);
  }
  @Get('lotes')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Listar lotes de productos' })
  @ApiOkResponse({ schema: paginatedSchema(LoteProducto) })
  listLotes(@Query() q: DomainQueryDto) {
    return this.s.listLotes(q);
  }
  @Get('lotes/:id')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Consultar un lote por ID' })
  getLote(@Param('id', ParseIntPipe) id: number) {
    return this.s.oneLote(id);
  }
  @Patch('lotes/:id')
  @Permissions('inventario.actualizar')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Actualizar los datos de un lote',
    description:
      'Modifica los datos permitidos del lote; el stock inicial permanece inmutable.',
  })
  updateLote(@Param('id', ParseIntPipe) id: number, @Body() d: UpdateLoteDto) {
    return this.s.updateLote(id, d);
  }
  @Get('lotes/:id/stock')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Consultar el stock actual de un lote' })
  getStock(@Param('id', ParseIntPipe) id: number) {
    return this.s.stock(id);
  }
  @Post('servicios/:id/productos')
  @Permissions('inventario.actualizar')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Vincular un producto a un servicio',
    description:
      'Define el producto y la cantidad prevista para realizar el servicio indicado.',
  })
  linkServiceProduct(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: VincularServicioProductoDto,
  ) {
    return this.s.linkService(id, d);
  }
  @Get('servicios/:id/productos')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Listar productos vinculados a un servicio' })
  listServiceProducts(@Param('id', ParseIntPipe) id: number) {
    return this.s.listServiceProducts(id);
  }
  @Post('movimientos')
  @Permissions('inventario.crear')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({
    summary: 'Registrar un movimiento manual de inventario',
    description:
      'Registra una entrada o salida manual y evita que el stock del lote quede negativo.',
  })
  createMovement(@Body() d: CreateMovimientoDto, @CurrentUser() u: JwtPayload) {
    return this.s.createMovement(d, u.sub);
  }
  @Get('movimientos')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Listar movimientos de inventario' })
  @ApiOkResponse({ schema: paginatedSchema(MovimientoInventario) })
  listMovements(@Query() q: DomainQueryDto) {
    return this.s.listMovements(q);
  }
  @Get('movimientos/:id')
  @Permissions('inventario.leer')
  @Roles('ROOT', 'ADMINISTRADOR')
  @ApiOperation({ summary: 'Consultar un movimiento por ID' })
  getMovement(@Param('id', ParseIntPipe) id: number) {
    return this.s.oneMovement(id);
  }
  @Post('consumos-sesion')
  @Permissions('inventario.crear')
  @ApiOperation({
    summary: 'Registrar consumo de producto en una sesión',
    description:
      'Descuenta existencias de forma transaccional y relaciona el consumo con la sesión clínica.',
  })
  createConsumption(@Body() d: CreateConsumoDto, @CurrentUser() u: JwtPayload) {
    return this.s.createConsumption(d, u.sub);
  }
  @Get('consumos-sesion')
  @Permissions('inventario.leer')
  @ApiOperation({ summary: 'Listar consumos de productos por sesión' })
  @ApiOkResponse({ schema: paginatedSchema(ConsumoSesion) })
  listConsumptions(@Query() q: DomainQueryDto) {
    return this.s.listConsumptions(q);
  }
  @Post('salidas-venta')
  @Permissions('inventario.crear')
  @ApiOperation({
    summary: 'Registrar salida de producto por venta',
    description:
      'Descuenta existencias de forma transaccional y vincula la salida con el detalle vendido.',
  })
  createSaleOutput(
    @Body() d: CreateSalidaVentaDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.s.createSaleOutput(d, u.sub);
  }
  @Get('salidas-venta')
  @Permissions('inventario.leer')
  @ApiOperation({ summary: 'Listar salidas de productos por venta' })
  @ApiOkResponse({ schema: paginatedSchema(SalidaProductoVenta) })
  listSaleOutputs(@Query() q: DomainQueryDto) {
    return this.s.listSaleOutputs(q);
  }
}
