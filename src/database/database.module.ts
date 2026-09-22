import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { databaseConfig } from '../config/database.config.js';

@Module({
  imports: [TypeOrmModule.forRootAsync({ useFactory: databaseConfig })],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
