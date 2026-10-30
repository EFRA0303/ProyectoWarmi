# Servicio configurable y atención del paciente

## Reglas confirmadas

- Un servicio tiene un precio total, una cantidad estándar de sesiones y duración por sesión.
- Las ampliaciones de sesiones se autorizan y registran para el paciente; no cambian el catálogo para todos.
- Cada medición permite seleccionar uno o varios momentos: `INICIAL`, `CADA_SESION`, `FINAL`, además de su obligatoriedad.
- Los productos configurados son insumos previstos por sesión, con cantidad y unidad. La configuración no reserva ni descuenta existencias.
- Durante la atención se registrará consumo real o «No utilizado». Un producto extra tendrá las opciones **Sin costo adicional** y **Con costo adicional**. La segunda requerirá importe y motivo; registrar el cargo no equivale a registrar un pago.
- Sesiones clínicas y cuotas financieras son independientes.
- Ningún cambio en el catálogo debe recalcular adquisiciones, pagos o atenciones históricas.
- «Atención clínica» se retirará del menú solamente cuando sus funciones sean accesibles desde Agenda y la ficha del paciente. No se eliminarán tablas ni historial clínico.

## Etapa 1 implementada: configuración del catálogo

- `POST /catalogo/servicios` y `PATCH /catalogo/servicios/:id` aceptan `sesiones_incluidas`, `medidas` y `productos` en una única transacción.
- `medidas`: `{ id_tipo_medida, obligatorio, momentos: [...] }`.
- `productos`: `{ id_producto, cantidad_referencial }`, expresada en la unidad del insumo, por sesión.
- En una edición parcial, omitir una colección conserva sus asignaciones; enviar `[]` las elimina.
- Se rechazan duplicados, cantidades inválidas y nuevas asignaciones a recursos inactivos/no insumo.
- `GET /catalogo/insumos-opciones` permite configurar insumos con permiso `catalogo.leer`, sin conceder permisos generales de inventario al administrador del catálogo.
- Crear/editar servicio y la configuración independiente de mediciones utilizan el mismo componente de selección de momentos.
- Las nuevas adquisiciones guardan el precio total y las sesiones estándar vigentes como snapshots. El importe proporcional se redondea una sola vez en centavos: no se multiplica un unitario previamente redondeado.
- Paquetes conservan su precio comercial propio; promociones siguen aplicando su descuento sobre el importe de las sesiones contratadas.
- Los servicios directos se contratan desde Adquisiciones. Su nota es automática y los abonos requieren confirmación separada.

### Migración 1793300000000

Añade sesiones a servicios, momentos a servicios_medidas y snapshots de precio/sesiones a detalles_adquisicion. Adapta la comprobación matemática para conservar exactamente el total, incluso si precio/sesiones tiene decimales periódicos.

Servicios anteriores: una sesión por defecto, sin cambiar el importe almacenado. Se deben revisar manualmente antes de convertirlos en servicios de varias sesiones; el sistema no puede inferir su cantidad ni su precio total real. Adquisiciones anteriores conservan sus valores y su comprobación matemática original.

La reversión se bloquea si existen adquisiciones generadas con el nuevo modelo. No se descarta información financiera para forzar un rollback.

## Organización clínica integrada

- Un único acceso lateral **Atención → Servicios del paciente**. La entrada elige la vista autorizada según permisos, sin conceder permisos nuevos.
- La ruta existente `/dashboard/tratamientos` ahora presenta Servicios del paciente. Conserva asignaciones, ampliaciones y cancelaciones; no se renombraron entidades ni tablas.
- Las nuevas asignaciones requieren una adquisición compatible con sesiones disponibles y primer abono, salvo importe total cero. La selección de paciente/servicio limpia adquisiciones incompatibles. La asignación clínica no registra compras ni pagos automáticamente. Se conservan asignaciones históricas sin adquisición.
- Las pestañas internas permiten consultar servicios, sesiones y valoraciones; los enlaces desde cada servicio conservan el paciente y su asignación. Los filtros y la paginación conservan ese contexto.
- **Agenda → Llegó → Atender** abre el formulario de inicio con cita, paciente, profesional y número de sesión preseleccionados. Solo se ofrece Atender con permisos clínicos de lectura/creación. Las citas vinculadas a un servicio ya no ofrecen marcar Atendida manualmente desde esa interfaz; el cierre clínico existente actualiza la cita.
- En la vista diaria, pulsar el bloque de una cita abre su detalle con las acciones autorizadas. El detalle se obtiene de las citas ya cargadas y se mantiene actualizado por ID al cambiar su estado; no genera atenciones por el simple hecho de abrirlo.
- El expediente clínico enlaza con los servicios, sesiones y valoraciones del paciente. Las valoraciones consultadas por asignación incluyen tanto las vinculadas directamente como las de sus sesiones.
- Se mantienen las rutas anteriores para enlaces guardados. No se borraron registros ni se crearon sesiones, compras o pagos reales para comprobar la organización.

## Ventas e inventario integrados

Ver [commerce-inventory-workflow.md](commerce-inventory-workflow.md) para las reglas financieras, automatizaciones, migración y guía de pruebas.

## Etapas pendientes: protocolo clínico, extras y devoluciones

1. Congelar la configuración clínica/productos en la contratación o indicación del paciente. Guardar versiones para que una modificación posterior del catálogo no cambie su plan.
2. Endurecer la autorización y cobertura comercial de ampliaciones en el servidor; las sesiones estándar ya se proponen en la interfaz.
3. Completar el protocolo de valoración inicial/final y medidas por sesión, incluida validación del momento y versionado. La navegación Agenda → Atender y el acceso desde expediente ya están conectados; no equivalen a un protocolo clínico automático.
4. Checklist persistente por sesión con estados pendiente/usado/no utilizado. Los extras se eligen de insumos activos existentes, no crean productos en el catálogo.
5. Los consumos manuales ya guardan lote/cantidad real durante una sesión en curso, bloquean stock insuficiente/lotes no utilizables y protegen reintentos. Queda pendiente integrarlos al checklist y definir las correcciones compensatorias de forma explícita.
6. Registrar el tipo de costo del extra. `SIN_COSTO_ADICIONAL` exige importe cero; `CON_COSTO_ADICIONAL` exige importe positivo, motivo y aceptación antes del cobro. Conectar cargos pendientes con Caja, evitando cobrarlos dos veces y manteniendo separados consumo, cargo y pago.
7. Validar en el servidor las medidas obligatorias según el momento y el checklist antes de finalizar. Consumos y cierre deben ser transaccionales; la cita pasa a atendida junto con el cierre de sesión.
8. Mantener pruebas de regresión de ampliaciones, sesiones y valoraciones históricas. El grupo lateral Atención clínica ya fue retirado y sus funciones existentes tienen acceso desde Servicios del paciente.

Las reglas clínicas adicionales, el checklist y los cargos extra no están implementados por reorganizar la navegación y no deben darse por habilitados todavía.

## Validación

- Backend: `pnpm run build`; pruebas unitarias `pnpm exec vitest run test/service-configuration.spec.ts test/entities.spec.ts test/patient-care.spec.ts`.
- Integración: `node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.config.e2e.ts test/service-configuration.e2e-spec.ts`. Crea y elimina exclusivamente una base temporal con nombre `warmi_catalog_test_<aleatorio>`; no ejecuta seeds ni crea operaciones en la base de trabajo.
- Frontend: `node --test tests/navigation.test.mjs tests/catalog-presentation.test.mjs tests/service-configuration.test.mjs tests/patient-care.test.mjs`, ESLint, TypeScript y auditoría responsiva aislada.
