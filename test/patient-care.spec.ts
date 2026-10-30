import 'reflect-metadata';
import type { DataSource } from 'typeorm';
import { ClinicaService } from '../dist/modules/clinica/clinica.service.js';

describe('Consultas de atención con contexto del paciente', () => {
  it('incluye valoraciones del servicio y de sus sesiones sin perder el filtro de paciente', async () => {
    const calls: Array<{ sql: string; values: unknown[] }> = [];
    const db = {
      getRepository: () => ({}),
      manager: {
        query: async (sql: string, values: unknown[]) => {
          calls.push({ sql, values: [...values] });
          return calls.length === 1 ? [{ total: 0 }] : [];
        },
      },
    } as unknown as DataSource;
    const service = new ClinicaService(db);
    await service.listValoraciones({
      page: 1,
      limit: 10,
      id_paciente: 2,
      id_tratamiento: 7,
      id_sesion: 3,
    });
    expect(calls[0].sql).toContain('h.id_paciente = $1');
    expect(calls[0].sql).toContain(
      '(v.id_tratamiento = $2 OR ses.id_tratamiento = $2)',
    );
    expect(calls[0].sql).toContain('v.id_sesion = $3');
    expect(calls[0].values).toEqual([2, 7, 3]);
  });
});
