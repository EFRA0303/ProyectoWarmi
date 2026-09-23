import {
  Controller,
  Get,
  Inject,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { AccesosUsuarioService } from './accesos-usuario.service.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

@ApiBearerAuth('access-token')
@Controller('accesos-usuario')
@Permissions('accesos-usuario.leer')
export class AccesosUsuarioController {
  constructor(
    @Inject(AccesosUsuarioService)
    private readonly service: AccesosUsuarioService,
  ) {}
  @Get() findAll(@Query() query: PaginationDto) {
    return this.service.findAll(query);
  }
  @Get(':id') findOne(@Param('id') id: string) {
    if (
      !/^[1-9][0-9]*$/.test(id) ||
      id.length > 19 ||
      BigInt(id) > 9223372036854775807n
    )
      throw new BadRequestException('ID invalido');
    return this.service.findOne(id);
  }
}
