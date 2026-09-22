# Estructura del backend

- config: configuracion y validacion de variables de entorno.
- database: conexion TypeORM, registro de entidades, migraciones y seeds.
- common: decoradores, enums, interfaces y utilidades compartidas.
- modules: recursos de negocio, separados en controller, service, dto y entities.

Se generaron nueve recursos REST con Nest CLI. RolesPermisos y UsuariosPermisos
son entidades de relacion dentro de roles y permisos, no modulos independientes.
Auth implementa login con Passport local, JWT, perfil y cambio de contrasena.
Los guards globales comprueban sesion, estado del usuario/rol y permisos vigentes.

## Alcance actual

Las 11 entidades corresponden al diagrama entregado el 2026-09-21. Se usa PostgreSQL:
AUTO_INCREMENT se representa con PrimaryGeneratedColumn; TINYINT con SMALLINT y
restricciones de rango; UNSIGNED con CHECK; DATETIME con timestamptz.
Los BIGINT se representan como string en TypeScript para no perder precision.

Se unificaron created_by, created_at, updated_by y updated_at en personas,
pacientes, usuarios, personal, roles, permisos, configuracion_auditoria y las
dos tablas de asignaciones. Reemplazan creado_*, actualizado_* y asignado_*.
Auditoria y accesos conservan sus fechas/actores de eventos, sin duplicarlos.
Las fechas se gestionan con TypeORM y los responsables con NestJS desde el JWT.
updated_at se inicializa al crear; updated_by comienza null. Los autores y las
fechas no se admiten en DTOs del cliente. created_by/created_at no cambian al editar.

Altas, consultas y actualizaciones usan repositorios TypeORM y validacion de DTOs.
Las bajas solo cambian estado a BAJA; PATCH con ACTIVO permite reactivar.
No hay DELETE, deleted_at, softDelete ni eliminacion fisica en los servicios.
Personas no tiene estado en el diagrama y no ofrece ruta de baja. Configuracion
usa habilitado y protege eventos es_obligatorio contra deshabilitacion.
Auditoria y accesos no exponen rutas publicas para insertar, editar o borrar historial.
No hay funciones SQL, triggers ni registro automatico de eventos.
La migracion PostmanSchema esta preparada para una base vacia; no se ejecuto en
la base de trabajo. synchronize y migrationsRun permanecen desactivados.
No hay seeds automaticos. El usuario cargara sus registros iniciales manualmente.
Las asignaciones no se eliminan: permitido=false deniega un permiso individual.
La revocacion de permisos de rol queda pendiente de definir estado en esa relacion.

No se incluyen autorizar/rechazar usuario porque el nuevo diagrama solo contempla
ACTIVO, BAJA y BLOQUEADO. La configuracion es_obligatorio se reserva a la logica interna.

## Verificacion

pnpm run build
pnpm run lint
pnpm run test
pnpm run test:e2e

Las pruebas unitarias verifican metadatos y contrasenas. Las e2e usan PostgreSQL
en una base temporal warmi_test_*, que eliminan al finalizar; no agregan datos a
la base de trabajo. Ver docs/POSTMAN.md para migracion, cuenta manual y coleccion.
