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
import { AdquisicionesService } from './adquisiciones.service.js';
import {
  CreateAdquisicionDto,
  UpdateAdquisicionDto,
} from './dto/adquisicion.dto.js';
import { Adquisicion } from './entities/comercial.entities.js';
@ApiTags('Adquisiciones')
@ApiBearerAuth('access-token')
@ApiExtraModels(Adquisicion)
@Controller('adquisiciones')
export class AdquisicionesController {
  constructor(
    @Inject(AdquisicionesService)
    private readonly service: AdquisicionesService,
  ) {}
  @Post() @Permissions('adquisiciones.crear') create(
    @Body() dto: CreateAdquisicionDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.create(dto, user.sub);
  }
  @Get()
  @Permissions('adquisiciones.leer')
  @ApiOkResponse({ schema: paginatedSchema(Adquisicion) })
  list(@Query() query: DomainQueryDto) {
    return this.service.list(query);
  }
  @Get(':id') @Permissions('adquisiciones.leer') one(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.one(id);
  }
  @Get(':id/detalles') @Permissions('adquisiciones.leer') details(
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.service.details(id);
  }
  @Patch(':id') @Permissions('adquisiciones.actualizar') update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdquisicionDto,
  ) {
    return this.service.update(id, dto);
  }
}
