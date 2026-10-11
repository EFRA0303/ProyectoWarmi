import { Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CrudService } from '../../common/utils/crud.service.js';
import { Auditoria } from './entities/auditoria.entity.js';
import type { DomainQueryDto } from '../../common/dto/domain-query.dto.js';

@Injectable()
export class AuditoriaService extends CrudService<Auditoria> {
  constructor(@Inject(DataSource) db: DataSource) {
    super(db.getRepository(Auditoria), 'id_auditoria');
    this.db = db;
  }
  private readonly db: DataSource;
  async findAllDetailed(q: DomainQueryDto) {
    const values: unknown[] = []; const conditions: string[] = [];
    const parameter = (value: unknown) => { values.push(value); return `$${values.length}`; };
    if (q.tipo) conditions.push(`a.entidad = ${parameter(q.tipo)}`);
    if (q.desde) conditions.push(`a.fecha >= ${parameter(q.desde)}`);
    if (q.hasta) conditions.push(`a.fecha <= ${parameter(q.hasta)}`);
    if (q.search) { const value = parameter(`%${q.search}%`); conditions.push(`(a.accion ILIKE ${value} OR a.entidad ILIKE ${value} OR COALESCE(a.descripcion,'') ILIKE ${value} OR pe.nombre ILIKE ${value} OR pe.ap_paterno ILIKE ${value})`); }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const [count] = (await this.db.manager.query(`SELECT COUNT(*)::int AS total FROM auditoria a JOIN usuarios u ON u.id_usuario=a.id_usuario_accion JOIN personas pe ON pe.id_persona=u.id_persona ${where}`,values)) as Array<{total:number}>;
    const limit=parameter(q.limit),offset=parameter((q.page-1)*q.limit);
    const data=await this.db.manager.query(`SELECT a.*, pe.nombre || ' ' || pe.ap_paterno AS usuario_accion, COALESCE(af.nombre || ' ' || af.ap_paterno,'—') AS usuario_afectado FROM auditoria a JOIN usuarios u ON u.id_usuario=a.id_usuario_accion JOIN personas pe ON pe.id_persona=u.id_persona LEFT JOIN usuarios ua ON ua.id_usuario=a.id_usuario_afectado LEFT JOIN personas af ON af.id_persona=ua.id_persona ${where} ORDER BY a.fecha DESC,a.id_auditoria DESC LIMIT ${limit} OFFSET ${offset}`,values);
    return {data,total:Number(count?.total??0),page:q.page,limit:q.limit};
  }
}
