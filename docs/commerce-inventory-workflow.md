# Ventas e inventario del spa

## Registros y automatizaciones

| Operación confirmada | Registros automáticos | No hace |
| --- | --- | --- |
| Adquirir servicio, paquete o promoción | Adquisición, detalles congelados, nota con número automático y saldo | Cobrar, crear una sesión o consumir insumos |
| Registrar abono | Pago y actualización del saldo | Entregar productos, consumir insumos o crear una sesión |
| Registrar lote recibido | Lote y un movimiento por la cantidad inicial | Crear una compra al proveedor ni un egreso de caja |
| Confirmar entrega de productos | Salidas y movimientos por lote, con vencimiento más próximo primero (FEFO) | Registrar otro pago |
| Confirmar consumo clínico | Consumo real y un movimiento del lote | Cobrar extras ni descontar lo meramente previsto |
| Completar pago y sesiones adquiridas | Estado COMPLETADA de la adquisición | Permitir completar manualmente o borrar el historial |

- Servicios se venden desde **Adquisiciones**; las notas manuales nuevas son para productos. Paquetes conservan su precio propio y las promociones aplican su descuento configurado.
- Una nota es un registro interno, **no una factura fiscal**. La numeración automática utiliza `NV-A-########`; puede tener saltos por transacciones revertidas.
- Las cuotas no dependen del número de sesiones. El primer abono habilita nuevas asignaciones e inicio de sesiones vinculadas; servicios totalmente gratuitos no requieren un pago ficticio.
- El precio de un producto corresponde a una **presentación completa**. Por ejemplo, Bs 50 por frasco de 100 ml: vender 2 frascos cobra Bs 100 y entregar descuenta 200 ml. Los detalles conservan precio, presentación y factor de conversión, aunque después cambie el catálogo. Los detalles anteriores conservan factor 1 para no reinterpretar sus salidas.
- Lotes, stock y consumos usan la unidad base. No cambiar esa unidad en productos con movimientos históricos. El costo unitario de lote también debe ingresarse por unidad base, no por frasco.
- Entrega exige nota emitida y totalmente pagada. Excluye productos inactivos/no vendibles y lotes vencidos, dados de baja o con ingreso futuro. Si falta stock de cualquier concepto, se revierte toda la entrega nueva, no entregas previas.
- Una salida manual parcial puede completarse desde Entregar, incluso con el mismo lote. Se agrega otro movimiento; jamás se cambia el movimiento anterior. El formulario manual protege reintentos por detalle+lote+cantidad y rechaza reutilizar ese lote con otra cantidad; para completar usa Entregar.
- Consumo manual: solamente insumos configurados del servicio, durante sesión EN_CURSO. Repetir la misma sesión+lote+cantidad devuelve el registro existente; otra cantidad para ese lote requiere resolverlo explícitamente, no sobrescribirla. No se permite cancelar una sesión con consumos.

## Integridad y trazabilidad

- Importes y cantidades se calculan en centésimos enteros; no se suman montos con coma flotante.
- Los formularios nuevos de adquisición, nota, abono, lote y movimiento manual envían una clave UUID estable mientras están abiertos. El servidor serializa por clave, verifica actor/contenido y devuelve el registro original al reintentar. La misma clave con otros datos se rechaza. Abrir un formulario nuevo representa otra operación; ante una respuesta incierta, consultar el listado antes de volver a registrar.
- Bloqueos transaccionales serializan pagos y entregas por nota y movimientos por lote. Dos cobros no pueden superar el saldo ni dos entregas descontar el mismo stock disponible.
- Anulaciones exigen motivo de al menos cinco caracteres y guardan actor. Conservan importes y registros originales. Anular una nota vinculada cancela también la adquisición, y viceversa.
- Se bloquea anular notas/adquisiciones con pagos registrados, productos entregados o servicios asignados/atención utilizada sin resolver. Se bloquea anular pagos cuando ya hubo entrega o sesión iniciada/finalizada.
- **Anular no devuelve dinero ni repone inventario.** Las devoluciones monetarias y de productos necesitan un procedimiento compensatorio todavía pendiente. Anular un pago se reserva a corregir registros que no tienen entregas/atenciones asociadas.

## Migración 1793400000000

Agrega claves/huellas de operación en cinco tablas; actor/motivo de anulación en adquisiciones, notas y pagos; y `factor_stock` en detalles de nota. Permite varias salidas del mismo detalle/lote para completar entregas parciales sin modificar movimientos previos. No crea notas retroactivas, pagos ni movimientos para adquisiciones históricas.

La reversión se bloquea si ya existen claves usadas, atribuciones de anulación, factores de conversión nuevos o múltiples entregas del mismo detalle/lote. No se debe borrar información para forzarla.

Antes de aplicar: compilar, probar en PostgreSQL temporal y comprobar que sea la única migración pendiente. El esquema usa `synchronize: false`.

## Guía de pruebas funcionales

Usar un paciente y productos identificados como PRUEBA. No simular cobros reales ni mezclar lotes de prueba con stock operativo.

1. Configurar servicio de Bs 300 con 3 sesiones. Contratarlo en Adquisiciones. Comprobar una nota por Bs 300, saldo Bs 300, cero pagos y cero movimientos de inventario.
2. Intentar asignarlo sin abono: debe rechazarse. Registrar Bs 50 en Ventas → Pagos, asignar el servicio y atender una sesión. El saldo sigue Bs 250; la sesión no genera otro cobro.
3. Registrar los Bs 250 restantes. La adquisición no se completa hasta finalizar todas sus sesiones. Comprobar entonces COMPLETADA.
4. Crear producto vendible a Bs 50/frasco, contenido 100 ml. Registrar dos lotes con 60 ml y 100 ml, vencimientos distintos. Comprobar un único movimiento inicial por lote.
5. Crear nota por un frasco: Bs 50. Pagar Bs 25 e intentar entregar: debe bloquearse. Pagar el resto y confirmar Entregar: primero 60 ml del lote de vencimiento más próximo y luego 40 ml del otro. Repetir no cambia el stock.
6. Intentar una entrega con cantidad superior al stock utilizable: ninguna salida nueva ni movimiento debe persistir. Lotes vencidos/dados de baja no deben utilizarse.
7. En una sesión en curso de un servicio con insumo configurado, registrar 2,50 ml reales. Comprobar consumo y un movimiento, sin cargo financiero. Al finalizar, no permitir consumos nuevos ni cancelar sesiones con consumo.
8. Anular una nota sin pagos ni atención: exigir motivo, conservar total histórico y mostrar saldo cero/Anulada. Con pagos o entrega: bloquear y explicar la necesidad de devolución. Anular adquisición debe coordinar también su nota.
9. Cambiar el precio/contenido del catálogo: la nota anterior y su conversión no deben cambiar. Comprobar que no se permite cambiar la unidad base de un producto con movimientos.
10. Revisar permisos con recepción, caja y profesional: la interfaz no concede permisos nuevos; el backend vuelve a autorizarlos.

## Validaciones automatizadas

```powershell
pnpm run test
pnpm run lint
node --env-file=.env node_modules/vitest/vitest.mjs run --config vitest.config.e2e.ts test/service-configuration.e2e-spec.ts test/commerce-inventory.e2e-spec.ts
```

La integración crea y elimina exclusivamente bases aleatorias `warmi_catalog_test_*` y `warmi_commerce_test_*`, nunca tablas ni operaciones en la base de trabajo. Incluye reintentos y concurrencia, abonos, snapshots, FEFO, entregas parciales, rollback, anulaciones y habilitación/finalización clínica.

En frontend: `node --test tests/*.test.mjs`, TypeScript, ESLint y auditoría visual aislada con API ficticia que rechaza escrituras. No sustituye una prueba manual con los roles reales.

## Pendiente explícito

Checklist persistente usado/no utilizado por sesión; extras **Sin costo adicional / Con costo adicional** y su aceptación/cargo; versionado del protocolo clínico; cobertura comercial de ampliaciones; devoluciones compensatorias; compras a proveedores y egresos de caja; facturación fiscal. Ninguna de esas funciones se simula con pagos o ajustes automáticos.
