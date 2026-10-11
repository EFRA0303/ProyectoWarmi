import {
  Controller,
  Get,
  Inject,
  Query,
  Param,
  BadRequestException,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AuditoriaService } from './auditoria.service.js';
import { Permissions } from '../../common/decorators/permissions.decorator.js';
import { DomainQueryDto } from '../../common/dto/domain-query.dto.js';

@ApiBearerAuth('access-token')
@Controller('auditoria')
@Permissions('auditoria.leer')
export class AuditoriaController {
  constructor(
    @Inject(AuditoriaService) private readonly service: AuditoriaService,
  ) {}
  @Get()
  @ApiOperation({ summary: 'Listar eventos de auditoría' })
  findAll(@Query() query: DomainQueryDto) {
    return this.service.findAllDetailed(query);
  }
  @Get(':id')
  @ApiOperation({ summary: 'Consultar un evento de auditoría por ID' })
  findOne(@Param('id') id: string) {
    if (
      !/^[1-9][0-9]*$/.test(id) ||
      id.length > 19 ||
      BigInt(id) > 9223372036854775807n
    )
      throw new BadRequestException('ID invalido');
    return this.service.findOne(id);
  }
}
