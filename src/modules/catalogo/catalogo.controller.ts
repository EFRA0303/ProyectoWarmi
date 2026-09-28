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
import { CatalogoService } from './catalogo.service.js';
import { CreateAreaDto, UpdateAreaDto } from './dto/area.dto.js';
import {
  CatalogoQueryDto,
  CategoriaQueryDto,
  ServicioQueryDto,
} from './dto/catalogo-query.dto.js';
import {
  CreateCategoriaServicioDto,
  UpdateCategoriaServicioDto,
} from './dto/categoria-servicio.dto.js';
import { CreateServicioDto, UpdateServicioDto } from './dto/servicio.dto.js';
import { AssignServicioMedidaDto } from './dto/servicio-medida.dto.js';
import {
  CreateTipoMedidaDto,
  UpdateTipoMedidaDto,
} from './dto/tipo-medida.dto.js';
import { Area } from './entities/area.entity.js';
import { CategoriaServicio } from './entities/categoria-servicio.entity.js';
import { Servicio } from './entities/servicio.entity.js';
import { TipoMedida } from './entities/tipo-medida.entity.js';

const paginatedSchema = (model: string) => ({
  type: 'object',
  properties: {
    data: { type: 'array', items: { $ref: model } },
    total: { type: 'integer', example: 1 },
    page: { type: 'integer', example: 1 },
    limit: { type: 'integer', example: 20 },
  },
  required: ['data', 'total', 'page', 'limit'],
});

@ApiTags('Catálogo de servicios')
@ApiBearerAuth('access-token')
@ApiExtraModels(Area, CategoriaServicio, Servicio, TipoMedida)
@Controller('catalogo')
export class CatalogoController {
  constructor(
    @Inject(CatalogoService) private readonly service: CatalogoService,
  ) {}

  @Post('areas')
  @Permissions('catalogo.crear')
  @ApiOperation({ summary: 'Crear un área' })
  createArea(@Body() dto: CreateAreaDto) {
    return this.service.createArea(dto);
  }

  @Get('areas')
  @Permissions('catalogo.leer')
  @ApiOperation({ summary: 'Listar áreas del catálogo' })
  @ApiOkResponse({ schema: paginatedSchema(getSchemaPath(Area)) })
  findAreas(@Query() query: CatalogoQueryDto) {
    return this.service.findAreas(query);
  }

  @Get('areas/:id')
  @Permissions('catalogo.leer')
  @ApiOperation({ summary: 'Consultar un área por ID' })
  findArea(@Param('id', ParseIntPipe) id: number) {
    return this.service.findArea(id);
  }

  @Patch('areas/:id')
  @Permissions('catalogo.actualizar')
  @ApiOperation({ summary: 'Actualizar un área' })
  updateArea(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAreaDto,
  ) {
    return this.service.updateArea(id, dto);
  }

  @Post('categorias')
  @Permissions('catalogo.crear')
  @ApiOperation({ summary: 'Crear una categoría de servicios' })
  createCategory(@Body() dto: CreateCategoriaServicioDto) {
    return this.service.createCategory(dto);
  }

  @Get('categorias')
  @Permissions('catalogo.leer')
  @ApiOperation({ summary: 'Listar categorías de servicios' })
  @ApiOkResponse({ schema: paginatedSchema(getSchemaPath(CategoriaServicio)) })
  findCategories(@Query() query: CategoriaQueryDto) {
    return this.service.findCategories(query);
  }

  @Get('categorias/:id')
  @Permissions('catalogo.leer')
  @ApiOperation({ summary: 'Consultar una categoría por ID' })
  findCategory(@Param('id', ParseIntPipe) id: number) {
    return this.service.findCategory(id);
  }

  @Patch('categorias/:id')
  @Permissions('catalogo.actualizar')
  @ApiOperation({ summary: 'Actualizar una categoría de servicios' })
  updateCategory(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoriaServicioDto,
  ) {
    return this.service.updateCategory(id, dto);
  }

  @Post('servicios')
  @Permissions('catalogo.crear')
  @ApiOperation({ summary: 'Crear un servicio' })
  createService(@Body() dto: CreateServicioDto) {
    return this.service.createService(dto);
  }

  @Get('servicios')
  @Permissions('catalogo.leer')
  @ApiOperation({ summary: 'Listar servicios del catálogo' })
  @ApiOkResponse({ schema: paginatedSchema(getSchemaPath(Servicio)) })
  findServices(@Query() query: ServicioQueryDto) {
    return this.service.findServices(query);
  }

  @Get('servicios/:id')
  @Permissions('catalogo.leer')
  @ApiOperation({ summary: 'Consultar un servicio por ID' })
  findService(@Param('id', ParseIntPipe) id: number) {
    return this.service.findService(id);
  }

  @Patch('servicios/:id')
  @Permissions('catalogo.actualizar')
  @ApiOperation({ summary: 'Actualizar un servicio' })
  updateService(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServicioDto,
  ) {
    return this.service.updateService(id, dto);
  }

  @Post('tipos-medida')
  @Permissions('catalogo.crear')
  @ApiOperation({ summary: 'Crear un tipo de medida clínica' })
  createMeasureType(@Body() dto: CreateTipoMedidaDto) {
    return this.service.createMeasureType(dto);
  }

  @Get('tipos-medida')
  @Permissions('catalogo.leer')
  @ApiOperation({ summary: 'Listar tipos de medida clínica' })
  @ApiOkResponse({ schema: paginatedSchema(getSchemaPath(TipoMedida)) })
  findMeasureTypes(@Query() query: CatalogoQueryDto) {
    return this.service.findMeasureTypes(query);
  }

  @Get('tipos-medida/:id')
  @Permissions('catalogo.leer')
  @ApiOperation({ summary: 'Consultar un tipo de medida por ID' })
  findMeasureType(@Param('id', ParseIntPipe) id: number) {
    return this.service.findMeasureType(id);
  }

  @Patch('tipos-medida/:id')
  @Permissions('catalogo.actualizar')
  @ApiOperation({ summary: 'Actualizar un tipo de medida clínica' })
  updateMeasureType(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTipoMedidaDto,
  ) {
    return this.service.updateMeasureType(id, dto);
  }

  @Post('servicios/:id/medidas')
  @Permissions('catalogo.actualizar')
  @ApiOperation({ summary: 'Asignar o actualizar una medida del servicio' })
  assignMeasure(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignServicioMedidaDto,
  ) {
    return this.service.assignMeasure(id, dto);
  }

  @Get('servicios/:id/medidas')
  @Permissions('catalogo.leer')
  @ApiOperation({ summary: 'Listar las medidas configuradas del servicio' })
  findServiceMeasures(@Param('id', ParseIntPipe) id: number) {
    return this.service.findServiceMeasures(id);
  }
}
