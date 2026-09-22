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
import { PersonasService } from './personas.service.js';
import { CreatePersonaDto } from './dto/create-persona.dto.js';
import { UpdatePersonaDto } from './dto/update-persona.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';

@Controller('personas')
export class PersonasController {
  constructor(
    @Inject(PersonasService) private readonly service: PersonasService,
  ) {}

  @Post()
  @Permissions('personas.crear')
  create(@Body() dto: CreatePersonaDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
  @Get()
  @Permissions('personas.leer')
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @Permissions('personas.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions('personas.actualizar')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
}
