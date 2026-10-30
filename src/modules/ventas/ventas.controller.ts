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
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { paginatedSchema } from '../../common/swagger/paginated-schema.js';
import {
  CreateNotaVentaDto,
  CreatePagoDto,
  UpdateNotaVentaDto,
  UpdatePagoDto,
} from './dto/ventas.dto.js';
import { VentasService } from './ventas.service.js';
import { NotaVenta, Pago } from './entities/ventas.entities.js';
@ApiTags('Ventas y pagos')
@ApiBearerAuth('access-token')
@ApiExtraModels(NotaVenta, Pago)
@Controller('ventas')
export class VentasController {
  constructor(@Inject(VentasService) private s: VentasService) {}
  @Get('opciones')
  @Permissions('ventas.leer')
  @ApiOperation({ summary: 'Listar opciones para notas de venta y pagos' })
  options() {
    return this.s.options();
  }
  @Post('notas')
  @Permissions('ventas.crear')
  @ApiOperation({
    summary: 'Emitir una nota de venta',
    description:
      'Valida sus conceptos y calcula en el servidor los precios congelados, subtotales y total de la venta.',
  })
  createNota(@Body() d: CreateNotaVentaDto, @CurrentUser() u: JwtPayload) {
    return this.s.createNota(d, u.sub);
  }
  @Get('notas')
  @Permissions('ventas.leer')
  @ApiOperation({ summary: 'Listar notas de venta' })
  @ApiOkResponse({ schema: paginatedSchema(NotaVenta) })
  listNotas(@Query() q: DomainQueryDto) {
    return this.s.listNotas(q);
  }
  @Get('notas/:id')
  @Permissions('ventas.leer')
  @ApiOperation({ summary: 'Consultar una nota de venta por ID' })
  getNota(@Param('id', ParseIntPipe) id: number) {
    return this.s.oneNota(id);
  }
  @Patch('notas/:id')
  @Permissions('ventas.actualizar')
  @ApiOperation({
    summary: 'Actualizar o anular una nota de venta',
    description:
      'Permite modificar las observaciones o anular una nota conforme a sus reglas de estado.',
  })
  updateNota(
    @Param('id', ParseIntPipe) id: number,
    @Body() x: UpdateNotaVentaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.s.updateNota(id, x, user.sub);
  }
  @Post('notas/:id/entregar')
  @Permissions('ventas.actualizar')
  @ApiOperation({ summary: 'Confirmar entrega y descontar productos automáticamente por vencimiento de lote; requiere nota pagada' })
  deliver(@Param('id', ParseIntPipe) id: number, @CurrentUser() user: JwtPayload) {
    return this.s.deliverProducts(id, user.sub);
  }
  @Get('notas/:id/detalles')
  @Permissions('ventas.leer')
  @ApiOperation({ summary: 'Listar detalles de una nota de venta' })
  listDetalles(@Param('id', ParseIntPipe) id: number) {
    return this.s.detalles(id);
  }
  @Post('pagos')
  @Permissions('ventas.crear')
  @ApiOperation({
    summary: 'Registrar un pago de una venta',
    description:
      'Registra un pago total o parcial y valida que el importe no supere el saldo pendiente.',
  })
  createPago(@Body() d: CreatePagoDto, @CurrentUser() u: JwtPayload) {
    return this.s.createPago(d, u.sub);
  }
  @Get('pagos')
  @Permissions('ventas.leer')
  @ApiOperation({ summary: 'Listar pagos registrados' })
  @ApiOkResponse({ schema: paginatedSchema(Pago) })
  listPagos(@Query() q: DomainQueryDto) {
    return this.s.listPagos(q);
  }
  @Get('pagos/:id')
  @Permissions('ventas.leer')
  @ApiOperation({ summary: 'Consultar un pago por ID' })
  getPago(@Param('id', ParseIntPipe) id: number) {
    return this.s.onePago(id);
  }
  @Patch('pagos/:id')
  @Permissions('ventas.actualizar')
  @ApiOperation({
    summary: 'Actualizar o anular un pago',
    description:
      'Permite modificar sus observaciones o anularlo aplicando las reglas financieras definidas.',
  })
  updatePago(@Param('id', ParseIntPipe) id: number, @Body() d: UpdatePagoDto, @CurrentUser() user: JwtPayload) {
    return this.s.updatePago(id, d, user.sub);
  }
}
