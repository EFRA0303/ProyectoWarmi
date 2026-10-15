import type { MigrationInterface, QueryRunner } from 'typeorm';

export class NormalizePhonesE1641791800000000 implements MigrationInterface {
  name = 'NormalizePhonesE1641791800000000';

  private normalizeColumn(table: string, column: string) {
    return `
      UPDATE "${table}"
      SET "${column}" = CASE
        WHEN btrim("${column}") LIKE '+%' THEN '+' || regexp_replace("${column}", '[^0-9]', '', 'g')
        WHEN regexp_replace("${column}", '[^0-9]', '', 'g') ~ '^591([234][0-9]{6}|[67][0-9]{7})$'
          THEN '+' || regexp_replace("${column}", '[^0-9]', '', 'g')
        WHEN regexp_replace("${column}", '[^0-9]', '', 'g') ~ '^([234][0-9]{6}|[67][0-9]{7})$'
          THEN '+591' || regexp_replace("${column}", '[^0-9]', '', 'g')
        ELSE btrim("${column}")
      END
      WHERE "${column}" IS NOT NULL AND btrim("${column}") <> ''
    `;
  }

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(this.normalizeColumn('personas', 'telefono1'));
    await queryRunner.query(this.normalizeColumn('personas', 'telefono2'));
    await queryRunner.query(this.normalizeColumn('empresas', 'telefono1'));
    await queryRunner.query(this.normalizeColumn('empresas', 'telefono2'));
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    for (const [table, column] of [
      ['personas', 'telefono1'],
      ['personas', 'telefono2'],
      ['empresas', 'telefono1'],
      ['empresas', 'telefono2'],
    ]) {
      await queryRunner.query(
        `UPDATE "${table}" SET "${column}" = substring("${column}" from 5) WHERE "${column}" ~ '^\\+591([234][0-9]{6}|[67][0-9]{7})$'`,
      );
    }
  }
}
