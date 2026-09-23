# Pruebas con Postman

## Preparacion sin datos automaticos

La base configurada estaba vacia al revisar su esquema. No se crearon tablas
ni se insertaron cuentas, roles o permisos en ella. No hay seeds automaticos.

1. Revisa .env usando .env.example como referencia: DB_HOST, DB_PORT,
   DB_USERNAME, DB_PASSWORD, DB_DATABASE, un JWT_SECRET aleatorio de 32 o mas
   caracteres y la configuracion MAIL_*.
2. Cuando decidas crear las tablas, ejecuta `pnpm run db:migrate`.
   La migracion prepara exclusivamente el esquema y el registro de migraciones.
   Es para una base vacia: no la ejecutes sobre tablas creadas manualmente sin
   comparar antes el esquema. synchronize y migrationsRun estan desactivados.
3. Carga manualmente tus registros iniciales, como se explica a continuacion.
4. Ejecuta `pnpm run start:dev`. La URL predeterminada es http://localhost:3000.
5. Importa `postman/Warmi.postman_collection.json` en Postman.

Para probar correos, inicia Mailpit con `docker compose up -d mailpit`. El servidor
SMTP queda en localhost:1025 y la bandeja web en http://localhost:8025.

Tambien puedes probar la API desde Swagger UI en http://localhost:3000/docs.
Ejecuta primero `POST /auth/login`, copia `access_token` y pulsa **Authorize** para
probar las rutas protegidas. En la recuperacion de contrasena, copia desde Mailpit
el token original del enlace; el hash guardado en la base de datos no es utilizable.

## Cuenta cargada manualmente

Para poder iniciar sesion necesitas, en este orden:

- Un rol ACTIVO en roles. Su nombre no concede privilegios automaticamente.
- Una persona en personas.
- Un usuario ACTIVO que apunte a esa persona y rol. Guarda el correo en minusculas.
- Los permisos de las operaciones que vas a probar en permisos, con estado ACTIVO.
- Las asignaciones en roles_permisos para el rol de tu cuenta.

La columna contrasena_hash debe contener bcrypt, nunca la contrasena en texto plano.
Puedes ejecutar `pnpm run password:hash`: solicita una contrasena sin mostrarla y
devuelve el hash. Este comando no escribe en la base de datos.
Usa al menos 12 caracteres y no mas de 72 bytes UTF-8.

created_by puede ser null en la persona, rol y usuario inicial, porque aun no hay
un responsable previo. En las asignaciones usa el ID del usuario administrador.
created_at y updated_at se completan por defecto al insertar. updated_by puede
quedar null. Omite los IDs autogenerados al insertar para conservar sus secuencias.

## Permisos

Para personas, pacientes, usuarios, personal, roles, permisos y configuracion-auditoria:
`<recurso>.crear`, `<recurso>.leer`, `<recurso>.actualizar`.
Ejemplos: personas.crear, pacientes.leer, usuarios.actualizar.

- Crear usuarios requiere usuarios.crear y roles.asignar, porque se asigna un rol activo.
- Asignar permisos a roles requiere roles.asignar.
- Conceder o denegar permisos individuales requiere permisos.asignar.
- Consultar historial requiere auditoria.leer o accesos-usuario.leer.
- Dar de baja o reactivar requiere el permiso <recurso>.actualizar.

Las denegaciones individuales (permitido=false) prevalecen sobre los permisos del rol.
No se permite dar de baja o bloquear la propia cuenta desde su sesion.

## Login y token

En la coleccion configura correo y contrasena con tu cuenta manual. No exportes
esas variables con valores reales ni compartas tokens.

POST http://localhost:3000/auth/login (No Auth):

```json
{ "correo_acceso": "tu-correo@example.com", "contrasena": "tu-contrasena" }
```

La respuesta incluye access_token. La coleccion lo guarda en token automaticamente.
El resto de solicitudes hereda Authorization > Bearer Token > {{token}}.
GET /auth/me comprueba la sesion. No se ofrecen registros publicos de cuentas.

POST /auth/change-password recibe contrasena_actual y nueva_contrasena.
Despues debes iniciar sesion nuevamente: el JWT anterior queda invalidado.
Cinco intentos fallidos bloquean el acceso durante 15 minutos.

POST /auth/forgot-password recibe `correo_acceso`. La respuesta siempre es generica,
exista o no la cuenta. Abre el mensaje en Mailpit, copia el token de 64 caracteres
del enlace y guardalo en la variable `recovery_token` de Postman.

POST /auth/reset-password recibe `token` y `nueva_contrasena`. El token dura 15
minutos por defecto, se almacena hasheado, solo funciona una vez e invalida las
sesiones anteriores al restablecer la contrasena.

## Rutas

| Recurso       | Crear                         | Consultar                                                   | Actualizar                         | Baja                         |
| ------------- | ----------------------------- | ----------------------------------------------------------- | ---------------------------------- | ---------------------------- |
| Personas      | POST /personas                | GET /personas y /personas/:id                               | PATCH /personas/:id                | No tiene estado en el modelo |
| Pacientes     | POST /pacientes               | GET /pacientes y /pacientes/:id                             | PATCH /pacientes/:id               | PATCH /pacientes/:id/baja    |
| Usuarios      | POST /usuarios                | GET /usuarios y /usuarios/:id                               | PATCH /usuarios/:id                | PATCH /usuarios/:id/baja     |
| Personal      | POST /personal                | GET /personal y /personal/:id                               | PATCH /personal/:id                | PATCH /personal/:id/baja     |
| Roles         | POST /roles                   | GET /roles y /roles/:id                                     | PATCH /roles/:id                   | PATCH /roles/:id/baja        |
| Permisos      | POST /permisos                | GET /permisos y /permisos/:id                               | PATCH /permisos/:id                | PATCH /permisos/:id/baja     |
| Configuracion | POST /configuracion-auditoria | GET /configuracion-auditoria y /configuracion-auditoria/:id | PATCH /configuracion-auditoria/:id | Usa habilitado, no estado    |

Los listados aceptan page y limit (maximo 100). Los que tienen estado permiten
filtrar ?estado=ACTIVO o ?estado=BAJA. Por defecto se listan ambos estados.
No se filtran silenciosamente las relaciones historicas.

No hay DELETE ni deleted_at. Baja cambia estado a BAJA, conservando la fila.
Para pacientes y personal puedes enviar motivo_baja; en los otros recursos envia {}.
Para reactivar usa PATCH /recurso/:id con { "estado": "ACTIVO" }.
Una cuenta o rol en BAJA no puede iniciar sesion ni seguir usando su JWT.

## Relaciones y responsables

POST /roles/:id/permisos recibe { "id_permiso": 1 }.
GET /roles/:id/permisos consulta las asignaciones.
POST /permisos/usuarios recibe { "id_usuario": 1, "id_permiso": 1, "permitido": true }.
Repite con permitido=false para denegar sin eliminar la asignacion.
GET /permisos/usuarios/:id consulta permisos individuales.
No hay ruta para quitar fisicamente permisos de un rol; esa operacion queda pendiente
porque la tabla intermedia no tiene un estado de asignacion.

El backend asigna created_by y updated_by desde el JWT. No envies esos campos ni
created_at/updated_at en el Body. created_by/created_at se conservan al modificar.
En las asignaciones tambien se unificaron asignado_por/asignado_en con created_by/created_at.
updated_at se inicializa al crear, aunque updated_by sea null.

GET /auditoria y GET /accesos-usuario son solo consultas, con variantes /:id.
No se implemento el registro automatico del historial, funciones SQL ni triggers.
La configuracion de auditoria se almacena, pero aun no activa un capturador de eventos.

## Orden de prueba

Login, crear persona, elegir un rol existente o crear uno, crear usuario, crear
paciente/personal, consultar y actualizar. Usa IDs devueltos en vez de asumir que son 1.
La coleccion guarda los IDs de las altas. Los permisos iniciales ya existentes se
consultan antes de intentar crearlos otra vez para evitar duplicados.
Prueba bajas y cambios de contrasena al final. No ejecutes toda la coleccion con
Runner sin revisar el orden: las bajas pueden deshabilitar recursos de otras solicitudes.

400: datos invalidos. 401: credenciales/sesion no valida. 403: permiso insuficiente.
404: registro/ruta inexistente. 409: duplicado o referencia inexistente.

## Pruebas automaticas

pnpm run test verifica metadatos. pnpm run test:e2e crea y elimina una base
warmi_test_* aislada y usa fixtures solo alli. Requiere permiso PostgreSQL para
crear bases; no agrega informacion a la base configurada de trabajo.
