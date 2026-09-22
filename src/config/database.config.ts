import type { DataSourceOptions } from 'typeorm';
import { entities } from '../database/entities.js';
import { integerEnv, requiredEnv } from './env.validation.js';

export function databaseConfig(): DataSourceOptions {
  return {
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: integerEnv('DB_PORT', 5432),
    username: process.env.DB_USERNAME ?? 'warmi',
    password: requiredEnv('DB_PASSWORD'),
    database: process.env.DB_DATABASE ?? 'warmibd',
    entities,
    synchronize: false,
    migrationsRun: false,
  };
}
