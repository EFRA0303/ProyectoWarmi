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
import { PersonalService } from './personal.service.js';
import { CreatePersonalDto } from './dto/create-personal.dto.js';
import { UpdatePersonalDto } from './dto/update-personal.dto.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import type { JwtPayload } from '../../common/interfaces/jwt-payload.interface.js';
import { BajaDto } from '../../common/dto/baja.dto.js';

@Controller('personal')
export class PersonalController {
  constructor(
    @Inject(PersonalService) private readonly service: PersonalService,
  ) {}

  @Post()
  @Permissions('personal.crear')
  create(@Body() dto: CreatePersonalDto, @CurrentUser() user: JwtPayload) {
    return this.service.create(dto, user.sub);
  }
  @Get()
  @Permissions('personal.leer')
  findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Get(':id')
  @Permissions('personal.leer')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }
  @Patch(':id')
  @Permissions('personal.actualizar')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePersonalDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.update(id, dto, user.sub);
  }
  @Patch(':id/baja')
  @Permissions('personal.actualizar')
  deactivate(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: BajaDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.service.deactivate(id, user.sub, dto.motivo_baja);
  }
}
