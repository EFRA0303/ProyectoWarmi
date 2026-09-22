import 'reflect-metadata';
import { fileURLToPath } from 'node:url';
import { DataSource } from 'typeorm';
import { databaseConfig } from '../config/database.config.js';

export default new DataSource({
  ...databaseConfig(),
  migrations: [
    fileURLToPath(
      new URL('./migrations/*{.ts,.js}', import.meta.url),
    ).replaceAll('\\', '/'),
  ],
});
