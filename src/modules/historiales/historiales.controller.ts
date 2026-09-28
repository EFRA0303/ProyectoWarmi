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
  getSchemaPath,
} from '@nestjs/swagger';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { CreateHistorialDto } from './dto/create-historial.dto.js';
import { HistorialQueryDto } from './dto/historial-query.dto.js';
import { UpdateHistorialDto } from './dto/update-historial.dto.js';
import { HistorialesService } from './historiales.service.js';
import { Historial } from './entities/historial.entity.js';

@ApiTags('Historiales')
@ApiBearerAuth('access-token')
@ApiExtraModels(Historial)
@Controller('historiales')
export class HistorialesController {
  constructor(
    @Inject(HistorialesService) private readonly service: HistorialesService,
  ) {}

  @Post()
  @Permissions('historiales.crear')
  create(@Body() dto: CreateHistorialDto) {
    return this.service.create(dto);
  }

  @Get()
  @Permissions('historiales.leer')
  @ApiOperation({ summary: 'Listar todos los historiales' })
  @ApiOkResponse({
    description: 'Listado paginado de historiales.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(Historial) },
        },
        total: { type: 'integer', example: 1 },
        page: { type: 'integer', example: 1 },
        limit: { type: 'integer', example: 20 },
      },
      required: ['data', 'total', 'page', 'limit'],
    },
  })
  findAll(@Query() query: HistorialQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  @Permissions('historiales.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Patch(':id')
  @Permissions('historiales.actualizar')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateHistorialDto,
  ) {
    return this.service.update(id, dto);
  }
}
