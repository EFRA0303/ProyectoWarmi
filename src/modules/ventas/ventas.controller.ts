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
  @Post('notas') @Permissions('ventas.crear') createNota(
    @Body() d: CreateNotaVentaDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.s.createNota(d, u.sub);
  }
  @Get('notas')
  @Permissions('ventas.leer')
  @ApiOkResponse({ schema: paginatedSchema(NotaVenta) })
  listNotas(@Query() q: DomainQueryDto) {
    return this.s.listNotas(q);
  }
  @Get('notas/:id') @Permissions('ventas.leer') getNota(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.oneNota(id);
  }
  @Patch('notas/:id') @Permissions('ventas.actualizar') updateNota(
    @Param('id', ParseIntPipe) id: number,
    @Body() x: UpdateNotaVentaDto,
  ) {
    return this.s.updateNota(id, x);
  }
  @Get('notas/:id/detalles') @Permissions('ventas.leer') listDetalles(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.detalles(id);
  }
  @Post('pagos') @Permissions('ventas.crear') createPago(
    @Body() d: CreatePagoDto,
    @CurrentUser() u: JwtPayload,
  ) {
    return this.s.createPago(d, u.sub);
  }
  @Get('pagos')
  @Permissions('ventas.leer')
  @ApiOkResponse({ schema: paginatedSchema(Pago) })
  listPagos(@Query() q: DomainQueryDto) {
    return this.s.listPagos(q);
  }
  @Get('pagos/:id') @Permissions('ventas.leer') getPago(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.s.onePago(id);
  }
  @Patch('pagos/:id') @Permissions('ventas.actualizar') updatePago(
    @Param('id', ParseIntPipe) id: number,
    @Body() d: UpdatePagoDto,
  ) {
    return this.s.updatePago(id, d);
  }
}
