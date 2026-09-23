import dataSource from './data-source.js';
import { seedInitialAdmin } from './seeds/initial-admin.seed.js';

try {
  await dataSource.initialize();
  await seedInitialAdmin(dataSource);
} catch (error) {
  console.error('No se pudo ejecutar el seed inicial', error);
  process.exitCode = 1;
} finally {
  if (dataSource.isInitialized) await dataSource.destroy();
}
