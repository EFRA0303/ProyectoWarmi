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

Para personas, pacientes, historiales, usuarios, personal, roles, permisos y
configuracion-auditoria:
`<recurso>.crear`, `<recurso>.leer`, `<recurso>.actualizar`.
Ejemplos: personas.crear, pacientes.leer, historiales.actualizar.

El modulo de disponibilidad usa `disponibilidad.crear`,
`disponibilidad.leer` y `disponibilidad.actualizar` para sus tres recursos.
El catálogo usa `catalogo.crear`, `catalogo.leer` y `catalogo.actualizar`.
Los módulos restantes siguen el mismo patrón con los prefijos `comercial`,
`adquisiciones`, `clinica`, `agenda`, `ventas`, `inventario` y `empresa`.

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

| Recurso              | Crear                         | Consultar                                                   | Actualizar                         | Baja                         |
| -------------------- | ----------------------------- | ----------------------------------------------------------- | ---------------------------------- | ---------------------------- |
| Personas             | POST /personas                | GET /personas y /personas/:id                               | PATCH /personas/:id                | No tiene estado en el modelo |
| Pacientes            | POST /pacientes               | GET /pacientes y /pacientes/:id                             | PATCH /pacientes/:id               | PATCH /pacientes/:id/baja    |
| Historiales          | POST /historiales             | GET /historiales y /historiales/:id                         | PATCH /historiales/:id             | Usa ACTIVO o CERRADO         |
| Disponibilidad       | POST /disponibilidad/*        | GET /disponibilidad/* y /disponibilidad/*/:id               | PATCH /disponibilidad/*/:id        | No expone DELETE             |
| Catálogo             | POST /catalogo/*              | GET /catalogo/* y /catalogo/*/:id                           | PATCH /catalogo/*/:id              | Usa ACTIVO o BAJA            |
| Paquetes/promociones | POST /comercial/*             | GET /comercial/*                                            | PATCH /comercial/*                 | Estados según recurso        |
| Adquisiciones        | POST /adquisiciones           | GET /adquisiciones y sus detalles                           | PATCH /adquisiciones/:id           | No expone DELETE             |
| Clínica              | POST /clinica/*               | GET /clinica/*                                              | PATCH /clinica/*                   | Conserva evolución clínica   |
| Agenda               | POST /agenda/*                | GET /agenda/*                                               | PATCH /agenda/*                    | Incluye reprogramaciones     |
| Ventas               | POST /ventas/*                | GET /ventas/*                                               | PATCH /ventas/*                    | Notas y pagos anulables      |
| Inventario           | POST /inventario/*            | GET /inventario/*                                           | PATCH productos y lotes            | Movimientos inmutables       |
| Empresa              | POST /empresa/*               | GET /empresa/*                                              | PATCH /empresa/*                   | Empresa y documentos         |
| Usuarios             | POST /usuarios                | GET /usuarios y /usuarios/:id                               | PATCH /usuarios/:id                | PATCH /usuarios/:id/baja     |
| Personal             | POST /personal                | GET /personal y /personal/:id                               | PATCH /personal/:id                | PATCH /personal/:id/baja     |
| Roles                | POST /roles                   | GET /roles y /roles/:id                                     | PATCH /roles/:id                   | PATCH /roles/:id/baja        |
| Permisos             | POST /permisos                | GET /permisos y /permisos/:id                               | PATCH /permisos/:id                | PATCH /permisos/:id/baja     |
| Configuracion        | POST /configuracion-auditoria | GET /configuracion-auditoria y /configuracion-auditoria/:id | PATCH /configuracion-auditoria/:id | Usa habilitado, no estado    |

Los listados aceptan page y limit (maximo 100). Los que tienen estado permiten
filtrar ?estado=ACTIVO o ?estado=BAJA. Por defecto se listan ambos estados.
No se filtran silenciosamente las relaciones historicas.

Historiales admite `?estado=ACTIVO` o `?estado=CERRADO`. Cada paciente puede
tener un solo historial. `fecha_apertura` se genera en el servidor y ni esa fecha
ni `id_paciente` se pueden cambiar con PATCH. Solo se actualizan el estado y las
observaciones generales. El paciente debe existir y estar ACTIVO al abrirlo.

Disponibilidad agrupa estas rutas:

- `/disponibilidad/horarios`: horario semanal; filtra por `id_personal`,
  `dia_semana` y `estado` booleano.
- `/disponibilidad/horarios-extra`: horario autorizado para una fecha; filtra
  por `id_personal`, `fecha` y estado `AUTORIZADO` o `CANCELADO`.
- `/disponibilidad/bloqueos`: periodos no disponibles; filtra por `id_personal`.

Los rangos deben tener inicio menor que fin y no pueden superponerse con otro
rango activo del mismo tipo. Las fechas con hora requieren zona, por ejemplo
`2030-01-10T09:00:00-04:00`. El autorizador de un horario extra se obtiene del JWT.

El catálogo agrupa áreas, categorías, servicios y tipos de medida. Para crear
una categoría su área debe estar ACTIVA; para crear un servicio también deben
estar activos su categoría y área. Las medidas se asignan mediante
`POST /catalogo/servicios/:id/medidas` y se consultan con GET en la misma ruta.

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

Los accesos se registran automaticamente; no existe una ruta para crearlos o
modificarlos manualmente. Cada intento conserva usuario o correo intentado, fecha,
IP, navegador, resultado y motivo del fallo. POST /auth/logout completa fecha_logout
y deja inválido el JWT de esa sesion.

Consultas administrativas disponibles:

- GET /accesos-usuario: historial general; admite id_usuario y login_exitoso.
- GET /accesos-usuario/exitosos y /fallidos: historiales por resultado.
- GET /accesos-usuario/usuario/:idUsuario: historial de un usuario.
- GET /accesos-usuario/ultimos: ultimo acceso exitoso por usuario.
- GET /accesos-usuario/:id: detalle de un registro.
- DELETE /accesos-usuario: elimina todo el historial.
- DELETE /accesos-usuario/usuario/:idUsuario: elimina el historial de un usuario.

Los borrados requieren accesos-usuario.eliminar. LOGIN_EXITOSO, LOGIN_FALLIDO,
LOGOUT, USUARIO_BLOQUEADO y CAMBIO_CONTRASENA son eventos obligatorios y no pueden
deshabilitarse. Los demas eventos configurados respetan el campo habilitado.

## Orden de prueba

Login, crear persona, elegir un rol existente o crear uno, crear usuario, crear
paciente/personal, abrir el historial, consultar y actualizar. Usa IDs devueltos
en vez de asumir que son 1.
La coleccion guarda los IDs de las altas. Los permisos iniciales ya existentes se
consultan antes de intentar crearlos otra vez para evitar duplicados.
Prueba bajas y cambios de contrasena al final. No ejecutes toda la coleccion con
Runner sin revisar el orden: las bajas pueden deshabilitar recursos de otras solicitudes.

La carpeta `10 - Historiales` usa `paciente_id` y guarda automáticamente la alta
en `historial_id`. Ejecutala en orden para probar creación, listados, consulta por
ID, observaciones, cierre, reapertura, duplicado y campos inmutables.

La carpeta `11 - Disponibilidad` requiere un `personal_id` ACTIVO y guarda
`horario_id`, `horario_extra_id` y `bloqueo_id`. Ejecutala en orden para probar
horario semanal, horario extra autorizado y bloqueo temporal.

La carpeta `12 - Catálogo de servicios` guarda `area_id`, `categoria_id`,
`servicio_id` y `tipo_medida_id`. Debe ejecutarse en ese orden jerárquico.

Las carpetas `13` a `19` cubren paquetes/promociones, adquisiciones, atención
clínica, agenda, ventas/pagos, inventario y empresa. Sus cuerpos usan las
variables creadas por las carpetas anteriores. Las altas principales guardan
automáticamente sus IDs como variables de colección.

En adquisiciones y notas de venta los importes finales y los textos snapshot se
calculan en el backend. Los valores enviados por el cliente no sustituyen los
datos de catálogo. Se permiten pagos parciales, pero la suma de pagos registrados
no puede superar el total de la nota. Notas y pagos consolidados se anulan; no se
reescriben sus importes.

Las citas requieren que el personal tenga horario semanal o extra autorizado.
También se validan bloqueos, cruces del paciente o profesional y la pertenencia
del tratamiento. Para registrar una sesión desde una cita, la cita debe estar en
`EN_ESPERA`.

Al crear un lote, `cantidad_inicial` genera su movimiento de entrada. No registres
otra entrada por el mismo stock inicial. Las salidas, consumos, mermas y ajustes
de salida se rechazan si dejarían stock negativo.

Los listados de los módulos nuevos admiten `page`, `limit`, `estado`, `search`,
`desde`, `hasta` y los filtros de relación aplicables, como `id_paciente`,
`id_personal`, `id_historial`, `id_servicio`, `id_tratamiento`, `id_producto`,
`id_lote` e `id_nota_venta`.

La carpeta `22 - Accesos de usuarios` contiene todas las consultas y termina con
dos DELETE destructivos. `23 - Cerrar sesión` debe ejecutarse al final porque
invalida el JWT y elimina la variable `token` de la colección.

400: datos invalidos. 401: credenciales/sesion no valida. 403: permiso insuficiente.
404: registro/ruta inexistente. 409: duplicado o referencia inexistente.

## Pruebas automaticas

pnpm run test verifica metadatos. pnpm run test:e2e crea y elimina una base
warmi_test_* aislada y usa fixtures solo alli. Requiere permiso PostgreSQL para
crear bases; no agrega informacion a la base configurada de trabajo.
