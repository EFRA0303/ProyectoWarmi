import { MigrationInterface, QueryRunner } from 'typeorm';

export class DomainModulesFiveToEleven1790600000000 implements MigrationInterface {
  name = 'DomainModulesFiveToEleven1790600000000';

  public async up(q: QueryRunner): Promise<void> {
    const enumType = async (name: string, values: string[]) =>
      q.query(
        `DO $$ BEGIN CREATE TYPE "${name}" AS ENUM (${values.map((v) => `'${v}'`).join(',')}); EXCEPTION WHEN duplicate_object THEN NULL; END $$`,
      );
    await enumType('tipo_descuento', ['PORCENTAJE', 'MONTO_FIJO']);
    await enumType('estado_promocion', [
      'PROGRAMADA',
      'ACTIVA',
      'FINALIZADA',
      'CANCELADA',
    ]);
    await enumType('estado_adquisicion', ['ACTIVA', 'COMPLETADA', 'CANCELADA']);
    await enumType('estado_solicitud', [
      'PENDIENTE',
      'VALORADO',
      'ACEPTADO',
      'DESCARTADO',
    ]);
    await enumType('estado_tratamiento', [
      'PENDIENTE',
      'EN_CURSO',
      'FINALIZADO',
      'CANCELADO',
    ]);
    await enumType('tipo_valoracion', ['INICIAL', 'EVOLUCION', 'FINAL']);
    await enumType('estado_cita', [
      'PROGRAMADA',
      'EN_ESPERA',
      'ATENDIDA',
      'CANCELADA',
      'NO_ASISTIO',
    ]);
    await enumType('solicitante_reprogramacion', [
      'PACIENTE',
      'PERSONAL',
      'SISTEMA',
    ]);
    await enumType('tipo_notificacion', [
      'CONFIRMACION',
      'RECORDATORIO',
      'REPROGRAMACION',
      'CANCELACION',
    ]);
    await enumType('canal_notificacion', [
      'EMAIL',
      'WHATSAPP',
      'SMS',
      'SISTEMA',
    ]);
    await enumType('estado_notificacion', [
      'PENDIENTE',
      'ENVIADA',
      'ERROR',
      'CANCELADA',
    ]);
    await enumType('estado_nota_venta', ['EMITIDA', 'ANULADA']);
    await enumType('metodo_pago', [
      'EFECTIVO',
      'QR',
      'TRANSFERENCIA',
      'TARJETA',
      'OTRO',
    ]);
    await enumType('estado_pago', ['REGISTRADO', 'ANULADO']);
    await enumType('estado_lote', ['DISPONIBLE', 'AGOTADO', 'VENCIDO', 'BAJA']);
    await enumType('tipo_movimiento_inventario', [
      'ENTRADA_COMPRA',
      'CONSUMO_SESION',
      'VENTA',
      'AJUSTE_ENTRADA',
      'AJUSTE_SALIDA',
      'MERMA',
      'VENCIMIENTO',
    ]);

    await q.query(
      `CREATE TABLE IF NOT EXISTS paquetes (id_paquete SERIAL PRIMARY KEY,nombre varchar(120) NOT NULL UNIQUE,descripcion varchar(255),precio numeric(10,2) NOT NULL CHECK(precio>=0),estado estado_general NOT NULL DEFAULT 'ACTIVO')`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS paquetes_servicios (id_paquete integer NOT NULL REFERENCES paquetes(id_paquete) ON DELETE RESTRICT,id_servicio integer NOT NULL REFERENCES servicios(id_servicio) ON DELETE RESTRICT,sesiones_incluidas integer NOT NULL CHECK(sesiones_incluidas>0),PRIMARY KEY(id_paquete,id_servicio))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS promociones (id_promocion SERIAL PRIMARY KEY,nombre varchar(120) NOT NULL,descripcion varchar(255),tipo_descuento tipo_descuento NOT NULL,valor_descuento numeric(10,2) NOT NULL CHECK(valor_descuento>=0),fecha_inicio timestamptz NOT NULL,fecha_fin timestamptz NOT NULL,estado estado_promocion NOT NULL DEFAULT 'PROGRAMADA',CHECK(fecha_inicio<fecha_fin),CHECK(tipo_descuento<>'PORCENTAJE' OR valor_descuento<=100))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS promociones_servicios (id_promocion integer NOT NULL REFERENCES promociones(id_promocion) ON DELETE RESTRICT,id_servicio integer NOT NULL REFERENCES servicios(id_servicio) ON DELETE RESTRICT,sesiones_incluidas integer NOT NULL DEFAULT 1 CHECK(sesiones_incluidas>0),PRIMARY KEY(id_promocion,id_servicio))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS adquisiciones (id_adquisicion SERIAL PRIMARY KEY,id_paciente integer NOT NULL REFERENCES pacientes(id_paciente) ON DELETE RESTRICT,id_paquete integer REFERENCES paquetes(id_paquete) ON DELETE RESTRICT,id_promocion integer REFERENCES promociones(id_promocion) ON DELETE RESTRICT,fecha_adquisicion timestamptz NOT NULL,precio_original numeric(10,2) NOT NULL,descuento numeric(10,2) NOT NULL DEFAULT 0,total numeric(10,2) NOT NULL,registrado_por integer NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,estado estado_adquisicion NOT NULL DEFAULT 'ACTIVA',CHECK(NOT(id_paquete IS NOT NULL AND id_promocion IS NOT NULL)),CHECK(precio_original>=0 AND descuento>=0 AND total>=0 AND total=precio_original-descuento))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS detalles_adquisicion (id_detalle_adquisicion SERIAL PRIMARY KEY,id_adquisicion integer NOT NULL REFERENCES adquisiciones(id_adquisicion) ON DELETE RESTRICT,id_servicio integer NOT NULL REFERENCES servicios(id_servicio) ON DELETE RESTRICT,nombre_servicio_snapshot varchar(120) NOT NULL,sesiones_incluidas integer NOT NULL CHECK(sesiones_incluidas>0),precio_unitario numeric(10,2) NOT NULL,descuento numeric(10,2) NOT NULL DEFAULT 0,subtotal numeric(10,2) NOT NULL,UNIQUE(id_adquisicion,id_servicio),CHECK(precio_unitario>=0 AND descuento>=0 AND subtotal>=0))`,
    );

    await q.query(
      `CREATE TABLE IF NOT EXISTS solicitudes_servicio (id_solicitud SERIAL PRIMARY KEY,id_historial integer NOT NULL REFERENCES historiales(id_historial) ON DELETE RESTRICT,id_servicio integer NOT NULL REFERENCES servicios(id_servicio) ON DELETE RESTRICT,fecha_solicitud timestamptz NOT NULL,motivo varchar(255),estado estado_solicitud NOT NULL DEFAULT 'PENDIENTE')`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS tratamientos_paciente (id_tratamiento SERIAL PRIMARY KEY,id_historial integer NOT NULL REFERENCES historiales(id_historial) ON DELETE RESTRICT,id_servicio integer NOT NULL REFERENCES servicios(id_servicio) ON DELETE RESTRICT,indicado_por integer NOT NULL REFERENCES personal(id_personal) ON DELETE RESTRICT,id_detalle_adquisicion integer REFERENCES detalles_adquisicion(id_detalle_adquisicion) ON DELETE RESTRICT,sesiones_iniciales integer NOT NULL CHECK(sesiones_iniciales>0),fecha_inicio date,estado estado_tratamiento NOT NULL DEFAULT 'PENDIENTE',observaciones text)`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS ampliaciones_tratamiento (id_ampliacion SERIAL PRIMARY KEY,id_tratamiento integer NOT NULL REFERENCES tratamientos_paciente(id_tratamiento) ON DELETE RESTRICT,sesiones_agregadas integer NOT NULL CHECK(sesiones_agregadas>0),autorizado_por integer NOT NULL REFERENCES personal(id_personal) ON DELETE RESTRICT,fecha_ampliacion timestamptz NOT NULL,motivo varchar(255))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS sesiones (id_sesion SERIAL PRIMARY KEY,id_tratamiento integer NOT NULL REFERENCES tratamientos_paciente(id_tratamiento) ON DELETE RESTRICT,id_cita integer UNIQUE,atendido_por integer NOT NULL REFERENCES personal(id_personal) ON DELETE RESTRICT,fecha_sesion timestamptz NOT NULL,observaciones text)`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS valoraciones (id_valoracion SERIAL PRIMARY KEY,id_historial integer NOT NULL REFERENCES historiales(id_historial) ON DELETE RESTRICT,id_solicitud integer REFERENCES solicitudes_servicio(id_solicitud) ON DELETE RESTRICT,id_tratamiento integer REFERENCES tratamientos_paciente(id_tratamiento) ON DELETE RESTRICT,id_sesion integer REFERENCES sesiones(id_sesion) ON DELETE RESTRICT,id_personal integer NOT NULL REFERENCES personal(id_personal) ON DELETE RESTRICT,tipo tipo_valoracion NOT NULL,fecha_valoracion timestamptz NOT NULL,observaciones text,CHECK(num_nonnulls(id_solicitud,id_tratamiento,id_sesion)<=1))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS valoraciones_medidas (id_valoracion integer NOT NULL REFERENCES valoraciones(id_valoracion) ON DELETE RESTRICT,id_tipo_medida integer NOT NULL REFERENCES tipos_medida(id_tipo_medida) ON DELETE RESTRICT,valor numeric(10,2) NOT NULL,PRIMARY KEY(id_valoracion,id_tipo_medida))`,
    );

    await q.query(
      `CREATE TABLE IF NOT EXISTS citas (id_cita integer GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,id_paciente integer NOT NULL REFERENCES pacientes(id_paciente) ON DELETE RESTRICT,id_tratamiento integer REFERENCES tratamientos_paciente(id_tratamiento) ON DELETE RESTRICT,id_personal integer NOT NULL REFERENCES personal(id_personal) ON DELETE RESTRICT,numero_sesion integer,fecha_hora_inicio timestamptz NOT NULL,fecha_hora_fin timestamptz NOT NULL,fecha_llegada timestamptz,estado estado_cita NOT NULL DEFAULT 'PROGRAMADA',observaciones varchar(255),UNIQUE(id_tratamiento,numero_sesion),CHECK(numero_sesion IS NULL OR numero_sesion>0),CHECK(fecha_hora_inicio<fecha_hora_fin))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS reprogramaciones_cita (id_reprogramacion SERIAL PRIMARY KEY,id_cita integer NOT NULL REFERENCES citas(id_cita) ON DELETE RESTRICT,inicio_anterior timestamptz NOT NULL,fin_anterior timestamptz NOT NULL,inicio_nuevo timestamptz NOT NULL,fin_nuevo timestamptz NOT NULL,realizado_por integer NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,motivo varchar(255),registrado_en timestamptz NOT NULL DEFAULT now(),solicitado_por_tipo solicitante_reprogramacion NOT NULL,CHECK(inicio_anterior<fin_anterior),CHECK(inicio_nuevo<fin_nuevo))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS notificaciones_cita (id_notificacion SERIAL PRIMARY KEY,id_cita integer NOT NULL REFERENCES citas(id_cita) ON DELETE RESTRICT,tipo tipo_notificacion NOT NULL,canal canal_notificacion NOT NULL,programada_para timestamptz NOT NULL,enviada_en timestamptz,estado estado_notificacion NOT NULL DEFAULT 'PENDIENTE')`,
    );
    await q.query(`DO $$ BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE contype = 'f' AND conrelid = 'sesiones'::regclass
          AND pg_get_constraintdef(oid) LIKE 'FOREIGN KEY (id_cita)%'
      ) THEN
        ALTER TABLE sesiones ADD CONSTRAINT fk_sesiones_cita
          FOREIGN KEY(id_cita) REFERENCES citas(id_cita) ON DELETE RESTRICT;
      END IF;
    END $$`);

    await q.query(
      `CREATE TABLE IF NOT EXISTS productos (id_producto SERIAL PRIMARY KEY,nombre varchar(120) NOT NULL,descripcion varchar(255),unidad_medida varchar(30) NOT NULL,imagen_url varchar(500),es_insumo boolean NOT NULL DEFAULT true,es_vendible boolean NOT NULL DEFAULT false,stock_minimo numeric(10,2) NOT NULL DEFAULT 0,estado estado_general NOT NULL DEFAULT 'ACTIVO',CHECK(stock_minimo>=0))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS lotes_producto (id_lote SERIAL PRIMARY KEY,id_producto integer NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,numero_lote varchar(80),cantidad_inicial numeric(10,2) NOT NULL CHECK(cantidad_inicial>=0),fecha_ingreso date NOT NULL,fecha_vencimiento date,costo_unitario numeric(10,2),estado estado_lote NOT NULL DEFAULT 'DISPONIBLE',CHECK(costo_unitario IS NULL OR costo_unitario>=0),CHECK(fecha_vencimiento IS NULL OR fecha_ingreso<=fecha_vencimiento))`,
    );
    await q.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS uq_lotes_producto_numero ON lotes_producto(id_producto,numero_lote) WHERE numero_lote IS NOT NULL`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS servicios_productos (id_servicio integer NOT NULL REFERENCES servicios(id_servicio) ON DELETE RESTRICT,id_producto integer NOT NULL REFERENCES productos(id_producto) ON DELETE RESTRICT,cantidad_referencial numeric(10,2),PRIMARY KEY(id_servicio,id_producto),CHECK(cantidad_referencial IS NULL OR cantidad_referencial>0))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS movimientos_inventario (id_movimiento SERIAL PRIMARY KEY,id_lote integer NOT NULL REFERENCES lotes_producto(id_lote) ON DELETE RESTRICT,tipo tipo_movimiento_inventario NOT NULL,cantidad numeric(10,2) NOT NULL CHECK(cantidad>0),registrado_por integer NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,fecha_movimiento timestamptz NOT NULL,observaciones varchar(255))`,
    );

    await q.query(
      `CREATE TABLE IF NOT EXISTS notas_venta (id_nota_venta SERIAL PRIMARY KEY,id_adquisicion integer UNIQUE REFERENCES adquisiciones(id_adquisicion) ON DELETE RESTRICT,id_paciente integer REFERENCES pacientes(id_paciente) ON DELETE RESTRICT,emitido_por integer NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,numero_nota varchar(30) NOT NULL UNIQUE,fecha_emision timestamptz NOT NULL,subtotal numeric(10,2) NOT NULL,descuento numeric(10,2) NOT NULL DEFAULT 0,total numeric(10,2) NOT NULL,estado estado_nota_venta NOT NULL DEFAULT 'EMITIDA',observaciones varchar(255),CHECK(subtotal>=0 AND descuento>=0 AND total>=0 AND total=subtotal-descuento))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS detalles_nota_venta (id_detalle SERIAL PRIMARY KEY,id_nota_venta integer NOT NULL REFERENCES notas_venta(id_nota_venta) ON DELETE RESTRICT,id_servicio integer REFERENCES servicios(id_servicio) ON DELETE RESTRICT,id_producto integer REFERENCES productos(id_producto) ON DELETE RESTRICT,id_paquete integer REFERENCES paquetes(id_paquete) ON DELETE RESTRICT,descripcion_snapshot varchar(180) NOT NULL,unidad_snapshot varchar(30),cantidad numeric(10,2) NOT NULL CHECK(cantidad>0),precio_unitario numeric(10,2) NOT NULL,descuento numeric(10,2) NOT NULL DEFAULT 0,subtotal numeric(10,2) NOT NULL,CHECK(num_nonnulls(id_servicio,id_producto,id_paquete)=1),CHECK(precio_unitario>=0 AND descuento>=0 AND subtotal>=0))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS pagos (id_pago SERIAL PRIMARY KEY,id_nota_venta integer NOT NULL REFERENCES notas_venta(id_nota_venta) ON DELETE RESTRICT,monto numeric(10,2) NOT NULL CHECK(monto>0),metodo_pago metodo_pago NOT NULL,fecha_pago timestamptz NOT NULL,registrado_por integer NOT NULL REFERENCES usuarios(id_usuario) ON DELETE RESTRICT,estado estado_pago NOT NULL DEFAULT 'REGISTRADO',observaciones varchar(255))`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS consumos_sesion (id_consumo SERIAL PRIMARY KEY,id_sesion integer NOT NULL REFERENCES sesiones(id_sesion) ON DELETE RESTRICT,id_lote integer NOT NULL REFERENCES lotes_producto(id_lote) ON DELETE RESTRICT,id_movimiento integer NOT NULL UNIQUE REFERENCES movimientos_inventario(id_movimiento) ON DELETE RESTRICT,cantidad numeric(10,2) NOT NULL CHECK(cantidad>0),registrado_en timestamptz NOT NULL DEFAULT now())`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS salidas_producto_venta (id_salida SERIAL PRIMARY KEY,id_detalle integer NOT NULL REFERENCES detalles_nota_venta(id_detalle) ON DELETE RESTRICT,id_lote integer NOT NULL REFERENCES lotes_producto(id_lote) ON DELETE RESTRICT,id_movimiento integer NOT NULL UNIQUE REFERENCES movimientos_inventario(id_movimiento) ON DELETE RESTRICT,cantidad numeric(10,2) NOT NULL CHECK(cantidad>0))`,
    );

    await q.query(
      `CREATE TABLE IF NOT EXISTS empresas (id_empresa SERIAL PRIMARY KEY,nombre_comercial varchar(150) NOT NULL,razon_social varchar(150),telefono1 varchar(30),telefono2 varchar(30),correo varchar(150),direccion varchar(255),sitio_web varchar(200),logo_url varchar(255),moneda varchar(10) NOT NULL DEFAULT 'BOB',estado estado_general NOT NULL DEFAULT 'ACTIVO')`,
    );
    await q.query(
      `CREATE TABLE IF NOT EXISTS configuraciones_documentos (id_configuracion SERIAL PRIMARY KEY,id_empresa integer NOT NULL UNIQUE REFERENCES empresas(id_empresa) ON DELETE RESTRICT,encabezado varchar(255),pie_pagina varchar(255),mostrar_logo boolean NOT NULL DEFAULT true,mostrar_direccion boolean NOT NULL DEFAULT true,mostrar_telefono boolean NOT NULL DEFAULT true,mostrar_correo boolean NOT NULL DEFAULT true)`,
    );
  }

  public async down(): Promise<void> {
    // Migracion acumulativa e idempotente: no elimina datos de instalaciones adoptadas.
  }
}
