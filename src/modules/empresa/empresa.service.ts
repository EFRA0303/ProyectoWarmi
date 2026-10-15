import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager, In } from 'typeorm';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';
import { DomainResourceService } from '../../common/utils/domain-resource.service.js';
import type {
  CreateConfiguracionDocumentoDto,
  CreateEmpresaDto,
  UpdateConfiguracionDocumentoDto,
  UpdateEmpresaDto,
  UpdateHorarioAtencionDto,
} from './dto/empresa.dto.js';
import {
  ConfiguracionDocumento,
  ConfiguracionHorarioAtencion,
  Empresa,
  ExcepcionHorarioAtencion,
  Feriado,
  HorarioAtencionSemanal,
  TramoExcepcionHorarioAtencion,
} from './entities/empresa.entities.js';

import { DiaSemana } from '../../common/enums/dia-semana.enum.js';
import {
  optimizeCompanyLoginBackground,
  optimizeCompanyLogo,
} from '../../common/utils/company-logo.js';
import {
  readCompanyLoginBackground,
  readCompanyLoginPanelBackground,
  readCompanyLogo,
  writeCompanyLoginBackground,
  writeCompanyLoginPanelBackground,
  writeCompanyLogo,
} from '../../common/utils/company-logo-storage.js';
import { CURRENCY_CATALOG } from './data/currencies.js';
@Injectable()
export class EmpresaService {
  private readonly db: DataSource;
  private readonly empresas: DomainResourceService<Empresa>;
  private readonly configs: DomainResourceService<ConfiguracionDocumento>;
  constructor(@Inject(DataSource) db: DataSource) {
    this.db = db;
    this.empresas = new DomainResourceService(
      Empresa,
      'id_empresa',
      db.getRepository(Empresa),
      'Empresa',
    );
    this.configs = new DomainResourceService(
      ConfiguracionDocumento,
      'id_configuracion',
      db.getRepository(ConfiguracionDocumento),
      'Configuracion de documento',
    );
  }
  async create(dto: CreateEmpresaDto) {
    if ((await this.db.getRepository(Empresa).count()) > 0)
      throw new ConflictException(
        'La empresa ya está configurada. Utiliza la opción de editar.',
      );
    return this.empresas.create(dto);
  }
  list(q: DomainQueryDto) {
    return this.empresas.list(q);
  }
  async publicIdentity() {
    const company = await this.db.getRepository(Empresa).findOne({
      select: {
        nombre_comercial: true,
        logo_url: true,
        eslogan_principal: true,
        titulo_login: true,
        descripcion_corta: true,
        imagen_fondo_login_url: true,
        imagen_fondo_panel_login_url: true,
      },
      where: {},
      order: { id_empresa: 'ASC' },
    });
    return {
      nombre_comercial: company?.nombre_comercial.trim() || null,
      logo_disponible: Boolean(company?.logo_url),
      eslogan_principal: company?.eslogan_principal?.trim() || null,
      titulo_login: company?.titulo_login?.trim() || null,
      descripcion_corta: company?.descripcion_corta?.trim() || null,
      fondo_login_disponible: Boolean(company?.imagen_fondo_login_url),
      fondo_panel_login_disponible: Boolean(
        company?.imagen_fondo_panel_login_url,
      ),
    };
  }
  async getPublicLogo() {
    const company = await this.db.getRepository(Empresa).findOne({
      select: {
        logo_url: true,
      },
      where: {},
      order: { id_empresa: 'ASC' },
    });
    if (!company?.logo_url)
      throw new NotFoundException('La empresa no tiene un logo');
    try {
      return await readCompanyLogo(company.logo_url);
    } catch {
      throw new NotFoundException('No se encontró el logo de la empresa');
    }
  }
  async saveLoginBackground(
    id: number,
    file?: { buffer: Buffer; size: number },
  ) {
    const repository = this.db.getRepository(Empresa);
    if (!(await repository.existsBy({ id_empresa: id })))
      throw new NotFoundException('Empresa no encontrada');
    const image = await optimizeCompanyLoginBackground(file);
    const publicPath = await writeCompanyLoginBackground(image.data, id);
    await repository.update(id, { imagen_fondo_login_url: publicPath });
    return {
      imagen_fondo_login_url: publicPath,
      ancho: image.width,
      alto: image.height,
      bytes: image.size,
    };
  }
  async getPublicLoginBackground() {
    const company = await this.db.getRepository(Empresa).findOne({
      select: { imagen_fondo_login_url: true },
      where: {},
      order: { id_empresa: 'ASC' },
    });
    if (!company?.imagen_fondo_login_url)
      throw new NotFoundException('La empresa no tiene una imagen de fondo');
    try {
      return await readCompanyLoginBackground(company.imagen_fondo_login_url);
    } catch {
      throw new NotFoundException(
        'No se encontró la imagen de fondo de la empresa',
      );
    }
  }
  async saveLoginPanelBackground(
    id: number,
    file?: { buffer: Buffer; size: number },
  ) {
    const repository = this.db.getRepository(Empresa);
    if (!(await repository.existsBy({ id_empresa: id })))
      throw new NotFoundException('Empresa no encontrada');
    const image = await optimizeCompanyLoginBackground(file);
    const publicPath = await writeCompanyLoginPanelBackground(image.data, id);
    await repository.update(id, {
      imagen_fondo_panel_login_url: publicPath,
    });
    return {
      imagen_fondo_panel_login_url: publicPath,
      ancho: image.width,
      alto: image.height,
      bytes: image.size,
    };
  }
  async getPublicLoginPanelBackground() {
    const company = await this.db.getRepository(Empresa).findOne({
      select: { imagen_fondo_panel_login_url: true },
      where: {},
      order: { id_empresa: 'ASC' },
    });
    if (!company?.imagen_fondo_panel_login_url)
      throw new NotFoundException(
        'La empresa no tiene una imagen para el panel del acceso',
      );
    try {
      return await readCompanyLoginPanelBackground(
        company.imagen_fondo_panel_login_url,
      );
    } catch {
      throw new NotFoundException(
        'No se encontró la imagen del panel de acceso de la empresa',
      );
    }
  }
  listCurrencies() {
    return CURRENCY_CATALOG;
  }
  async getBusinessHours() {
    let schedule = await this.db.getRepository(ConfiguracionHorarioAtencion).findOne({
      where: {},
      order: { id_configuracion_horario: 'ASC' },
    });
    if (!schedule) {
      const company = await this.db.getRepository(Empresa).findOne({
        where: {},
        order: { id_empresa: 'ASC' },
      });
      if (!company)
        throw new NotFoundException(
          'Registra la empresa antes de configurar su horario de atención',
        );
      schedule = await this.db.transaction(async (manager) => {
        const repository = manager.getRepository(ConfiguracionHorarioAtencion);
        const created = await repository.save(
          repository.create({
          id_empresa: company.id_empresa,
          intervalo_minutos: 30,
          }),
        );
        await manager.getRepository(HorarioAtencionSemanal).save(
          [
            DiaSemana.LUNES,
            DiaSemana.MARTES,
            DiaSemana.MIERCOLES,
            DiaSemana.JUEVES,
            DiaSemana.VIERNES,
            DiaSemana.SABADO,
          ].map((dia_semana) => ({
            id_configuracion_horario: created.id_configuracion_horario,
            dia_semana,
            hora_inicio: '07:00',
            hora_fin: '20:00',
          })),
        );
        return created;
      });
    }
    return this.presentBusinessHours(schedule, this.db.manager);
  }
  async updateBusinessHours(dto: UpdateHorarioAtencionDto) {
    this.validateRanges(dto.horarios_semanales, dto.intervalo_minutos, 'horario semanal');
    const dates = new Set<string>();
    for (const exception of dto.excepciones) {
      if (dates.has(exception.fecha))
        throw new BadRequestException(`Existe más de una excepción para ${exception.fecha}`);
      dates.add(exception.fecha);
      if (exception.tipo === 'CERRADO' && exception.tramos.length)
        throw new BadRequestException('Un día cerrado no puede tener tramos de atención');
      if (exception.tipo === 'HORARIO_ESPECIAL' && !exception.tramos.length)
        throw new BadRequestException('Un horario especial debe tener al menos un tramo');
      this.validateRanges(exception.tramos, dto.intervalo_minutos, `excepción ${exception.fecha}`);
    }
    const holidays = new Set<string>();
    for (const holiday of dto.feriados) {
      const key = holiday.tipo === 'FIJO'
        ? `FIJO-${holiday.mes}-${holiday.dia}`
        : `DINAMICO-${holiday.fecha}`;
      if (holidays.has(key))
        throw new BadRequestException('Existe más de un feriado para la misma fecha');
      holidays.add(key);
      if (holiday.tipo === 'FIJO') {
        if (!holiday.mes || !holiday.dia || holiday.fecha)
          throw new BadRequestException('Un feriado fijo requiere día y mes, sin año');
        const sample = new Date(Date.UTC(2024, holiday.mes - 1, holiday.dia));
        if (sample.getUTCMonth() + 1 !== holiday.mes || sample.getUTCDate() !== holiday.dia)
          throw new BadRequestException(`La fecha fija ${holiday.dia}/${holiday.mes} no es válida`);
      } else if (!holiday.fecha || holiday.mes || holiday.dia) {
        throw new BadRequestException('Un feriado por año requiere una fecha completa');
      }
    }
    const current = await this.getBusinessHours();
    return this.db.transaction(async (manager) => {
      const repository = manager.getRepository(ConfiguracionHorarioAtencion);
      const row = await repository.findOneByOrFail({
        id_configuracion_horario: current.id_configuracion_horario,
      });
      row.intervalo_minutos = dto.intervalo_minutos;
      const exceptionRepository = manager.getRepository(ExcepcionHorarioAtencion);
      const previousExceptions = await exceptionRepository.findBy({
        id_configuracion_horario: row.id_configuracion_horario,
      });
      if (previousExceptions.length)
        await manager.getRepository(TramoExcepcionHorarioAtencion).delete({
          id_excepcion_horario: In(previousExceptions.map((item) => item.id_excepcion_horario)),
        });
      await exceptionRepository.delete({ id_configuracion_horario: row.id_configuracion_horario });
      await manager.getRepository(HorarioAtencionSemanal).delete({
        id_configuracion_horario: row.id_configuracion_horario,
      });
      await manager.getRepository(Feriado).delete({
        id_configuracion_horario: row.id_configuracion_horario,
      });
      await repository.save(row);
      await manager.getRepository(HorarioAtencionSemanal).save(
        dto.horarios_semanales.map((item) => ({
          id_configuracion_horario: row.id_configuracion_horario,
          dia_semana: item.dia_semana,
          hora_inicio: item.hora_inicio,
          hora_fin: item.hora_fin,
        })),
      );
      for (const item of dto.excepciones) {
        const exception = await exceptionRepository.save(
          exceptionRepository.create({
            id_configuracion_horario: row.id_configuracion_horario,
            fecha: item.fecha,
            tipo: item.tipo,
            motivo: item.motivo?.trim() || null,
          }),
        );
        if (item.tramos.length)
          await manager.getRepository(TramoExcepcionHorarioAtencion).save(
            item.tramos.map((range) => ({
              id_excepcion_horario: exception.id_excepcion_horario,
              hora_inicio: range.hora_inicio,
              hora_fin: range.hora_fin,
            })),
          );
      }
      if (dto.feriados.length)
        await manager.getRepository(Feriado).save(
          dto.feriados.map((holiday) => ({
            id_configuracion_horario: row.id_configuracion_horario,
            tipo: holiday.tipo,
            nombre: holiday.nombre.trim(),
            mes: holiday.tipo === 'FIJO' ? holiday.mes! : null,
            dia: holiday.tipo === 'FIJO' ? holiday.dia! : null,
            fecha: holiday.tipo === 'DINAMICO' ? holiday.fecha! : null,
          })),
        );
      return this.presentBusinessHours(row, manager);
    });
  }
  one(id: number) {
    return this.empresas.one(id);
  }
  update(id: number, dto: UpdateEmpresaDto) {
    return this.empresas.update(id, dto);
  }
  async saveLogo(id: number, file?: { buffer: Buffer; size: number }) {
    const repository = this.db.getRepository(Empresa);
    if (!(await repository.existsBy({ id_empresa: id })))
      throw new NotFoundException('Empresa no encontrada');
    const logo = await optimizeCompanyLogo(file);
    const publicPath = await writeCompanyLogo(logo.data, id);
    await repository.update(id, { logo_url: publicPath });
    return {
      logo_url: publicPath,
      ancho: logo.width,
      alto: logo.height,
      bytes: logo.size,
    };
  }
  async getLogo(id: number) {
    const company = await this.db.getRepository(Empresa).findOneBy({
      id_empresa: id,
    });
    if (!company?.logo_url)
      throw new NotFoundException('La empresa no tiene un logo');
    try {
      return await readCompanyLogo(company.logo_url);
    } catch {
      throw new NotFoundException('No se encontró el logo de la empresa');
    }
  }
  createConfig(dto: CreateConfiguracionDocumentoDto) {
    return this.configs.create(dto);
  }
  listConfigs(q: DomainQueryDto) {
    return this.configs.list(q);
  }
  oneConfig(id: number) {
    return this.configs.one(id);
  }
  updateConfig(id: number, dto: UpdateConfiguracionDocumentoDto) {
    return this.configs.update(id, dto);
  }
  private timeToMinutes(value: string) {
    const [hours, minutes] = value.split(':').map(Number);
    return hours * 60 + minutes;
  }
  private validateRanges(
    ranges: Array<{ hora_inicio: string; hora_fin: string; dia_semana?: DiaSemana }>,
    interval: number,
    label: string,
  ) {
    const groups = new Map<string, typeof ranges>();
    for (const range of ranges) {
      const start = this.timeToMinutes(range.hora_inicio);
      const end = this.timeToMinutes(range.hora_fin);
      if (start >= end)
        throw new BadRequestException(`La hora inicial debe ser anterior a la final en ${label}`);
      if ((end - start) % interval !== 0)
        throw new BadRequestException(`Los tramos de ${label} deben dividirse exactamente en intervalos de ${interval} minutos`);
      const key = range.dia_semana ?? 'FECHA';
      groups.set(key, [...(groups.get(key) ?? []), range]);
    }
    for (const group of groups.values()) {
      const sorted = [...group].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
      for (let index = 1; index < sorted.length; index += 1)
        if (sorted[index].hora_inicio < sorted[index - 1].hora_fin)
          throw new BadRequestException(`Existen tramos superpuestos en ${label}`);
    }
  }
  private async presentBusinessHours(
    schedule: ConfiguracionHorarioAtencion,
    manager: EntityManager,
  ) {
    const weekly = await manager.getRepository(HorarioAtencionSemanal).find({
      where: { id_configuracion_horario: schedule.id_configuracion_horario },
      order: { dia_semana: 'ASC', hora_inicio: 'ASC' },
    });
    const exceptions = await manager.getRepository(ExcepcionHorarioAtencion).find({
      where: { id_configuracion_horario: schedule.id_configuracion_horario },
      order: { fecha: 'ASC' },
    });
    const ranges = exceptions.length
      ? await manager.getRepository(TramoExcepcionHorarioAtencion).find({
          where: { id_excepcion_horario: In(exceptions.map((item) => item.id_excepcion_horario)) },
          order: { hora_inicio: 'ASC' },
        })
      : [];
    const holidays = await manager.getRepository(Feriado).find({
      where: { id_configuracion_horario: schedule.id_configuracion_horario },
      order: { mes: 'ASC', dia: 'ASC', fecha: 'ASC' },
    });
    return {
      id_configuracion_horario: schedule.id_configuracion_horario,
      id_empresa: schedule.id_empresa,
      intervalo_minutos: schedule.intervalo_minutos,
      horarios_semanales: weekly.map((item) => ({
        id_horario_atencion: item.id_horario_atencion,
        dia_semana: item.dia_semana,
        hora_inicio: item.hora_inicio.slice(0, 5),
        hora_fin: item.hora_fin.slice(0, 5),
      })),
      excepciones: exceptions.map((item) => ({
        id_excepcion_horario: item.id_excepcion_horario,
        fecha: item.fecha,
        tipo: item.tipo,
        motivo: item.motivo,
        tramos: ranges
          .filter((range) => range.id_excepcion_horario === item.id_excepcion_horario)
          .map((range) => ({
            id_tramo_excepcion: range.id_tramo_excepcion,
            hora_inicio: range.hora_inicio.slice(0, 5),
            hora_fin: range.hora_fin.slice(0, 5),
          })),
      })),
      feriados: holidays.map((item) => ({
        id_feriado: item.id_feriado,
        tipo: item.tipo,
        nombre: item.nombre,
        mes: item.mes,
        dia: item.dia,
        fecha: item.fecha,
      })),
    };
  }
}
