import type { MigrationInterface, QueryRunner } from 'typeorm';

export class PostmanSchema1790000000000 implements MigrationInterface {
  name = 'PostmanSchema1790000000000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(
      'CREATE TYPE "public"."genero" AS ENUM(\'FEMENINO\', \'MASCULINO\')',
    );
    await q.query(
      'CREATE TABLE "personas" ("created_by" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" integer, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_persona" SERIAL NOT NULL, "nombre" character varying(100) NOT NULL, "ap_paterno" character varying(100) NOT NULL, "ap_materno" character varying(100), "ci" character varying(20), "fecha_nac" date, "genero" "public"."genero" NOT NULL, "telefono1" character varying(30) NOT NULL, "telefono2" character varying(30), "direccion" character varying(255), CONSTRAINT "UQ_3a116924eb37c50413bd4cc2582" UNIQUE ("ci"), CONSTRAINT "UQ_cd043e5ea5a321206af22521222" UNIQUE ("telefono1"), CONSTRAINT "CHK_personas_id_persona" CHECK ("id_persona" > 0), CONSTRAINT "PK_a8294b844f4e1849ccf15ae57d1" PRIMARY KEY ("id_persona"))',
    );
    await q.query(
      'CREATE TYPE "public"."estado_general" AS ENUM(\'ACTIVO\', \'BAJA\')',
    );
    await q.query(
      'CREATE TABLE "pacientes" ("id_paciente" SERIAL NOT NULL, "id_persona" integer NOT NULL, "created_by" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" integer, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "ocupacion" character varying(60), "estado" "public"."estado_general" NOT NULL DEFAULT \'ACTIVO\', "motivo_baja" character varying(255), CONSTRAINT "UQ_db56c500b31531b85b055ad3408" UNIQUE ("id_persona"), CONSTRAINT "REL_db56c500b31531b85b055ad340" UNIQUE ("id_persona"), CONSTRAINT "CHK_pacientes_updated_by" CHECK ("updated_by" > 0), CONSTRAINT "CHK_pacientes_created_by" CHECK ("created_by" > 0), CONSTRAINT "CHK_pacientes_id_persona" CHECK ("id_persona" > 0), CONSTRAINT "CHK_pacientes_id_paciente" CHECK ("id_paciente" > 0), CONSTRAINT "PK_105479d9a4f1bea015407b060f5" PRIMARY KEY ("id_paciente"))',
    );
    await q.query(
      "CREATE TYPE \"public\".\"estado_usuario\" AS ENUM('ACTIVO', 'BAJA', 'BLOQUEADO')",
    );
    await q.query(
      'CREATE TABLE "usuarios" ("id_usuario" SERIAL NOT NULL, "id_persona" integer NOT NULL, "id_rol" smallint NOT NULL, "correo_acceso" character varying(150) NOT NULL, "nombre_usuario" character varying(50), "contrasena_hash" character varying(255) NOT NULL, "estado" "public"."estado_usuario" NOT NULL DEFAULT \'ACTIVO\', "intentos_fallidos" smallint NOT NULL DEFAULT \'0\', "bloqueado_hasta" TIMESTAMP WITH TIME ZONE, "created_by" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" integer, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "token_recuperacion_hash" character(64), "token_recuperacion_expira" TIMESTAMP WITH TIME ZONE, "ultimo_acceso_en" TIMESTAMP WITH TIME ZONE, "cambio_contrasena_en" TIMESTAMP WITH TIME ZONE, CONSTRAINT "UQ_5b29c4b5cc11b9c67c8b70c9cb2" UNIQUE ("id_persona"), CONSTRAINT "UQ_56baa7ad5353ee71ba7bb2dfee1" UNIQUE ("correo_acceso"), CONSTRAINT "UQ_1a7a36f3dffef210b4c0ba5c6c0" UNIQUE ("nombre_usuario"), CONSTRAINT "REL_5b29c4b5cc11b9c67c8b70c9cb" UNIQUE ("id_persona"), CONSTRAINT "CHK_usuarios_updated_by" CHECK ("updated_by" > 0), CONSTRAINT "CHK_usuarios_created_by" CHECK ("created_by" > 0), CONSTRAINT "CHK_usuarios_intentos_fallidos" CHECK ("intentos_fallidos" BETWEEN 0 AND 255), CONSTRAINT "CHK_usuarios_id_rol" CHECK ("id_rol" BETWEEN 1 AND 255), CONSTRAINT "CHK_usuarios_id_persona" CHECK ("id_persona" > 0), CONSTRAINT "CHK_usuarios_id_usuario" CHECK ("id_usuario" > 0), CONSTRAINT "PK_dfe59db369749f9042499fd8107" PRIMARY KEY ("id_usuario"))',
    );
    await q.query(
      'CREATE TABLE "personal" ("id_personal" SERIAL NOT NULL, "id_usuario" integer NOT NULL, "profesion" character varying(80) NOT NULL, "cargo" character varying(80) NOT NULL, "fecha_ingreso" date NOT NULL, "estado" "public"."estado_general" NOT NULL DEFAULT \'ACTIVO\', "motivo_baja" character varying(255), "created_by" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" integer, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_858ef107116ae13a2709cd45f49" UNIQUE ("id_usuario"), CONSTRAINT "REL_858ef107116ae13a2709cd45f4" UNIQUE ("id_usuario"), CONSTRAINT "CHK_personal_updated_by" CHECK ("updated_by" > 0), CONSTRAINT "CHK_personal_created_by" CHECK ("created_by" > 0), CONSTRAINT "CHK_personal_id_usuario" CHECK ("id_usuario" > 0), CONSTRAINT "CHK_personal_id_personal" CHECK ("id_personal" > 0), CONSTRAINT "PK_864a6cb3bb3822d28c178ce0995" PRIMARY KEY ("id_personal"))',
    );
    await q.query(
      'CREATE TABLE "roles" ("created_by" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" integer, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_rol" SMALLSERIAL NOT NULL, "nombre" character varying(60) NOT NULL, "descripcion" character varying(255), "estado" "public"."estado_general" NOT NULL DEFAULT \'ACTIVO\', CONSTRAINT "UQ_a5be7aa67e759e347b1c6464e10" UNIQUE ("nombre"), CONSTRAINT "CHK_roles_id_rol" CHECK ("id_rol" BETWEEN 1 AND 255), CONSTRAINT "PK_25f8d4161f00a1dd1cbe5068695" PRIMARY KEY ("id_rol"))',
    );
    await q.query(
      'CREATE TABLE "permisos" ("created_by" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_by" integer, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_permiso" SERIAL NOT NULL, "permiso" character varying(80) NOT NULL, "descripcion" character varying(255), "estado" "public"."estado_general" NOT NULL DEFAULT \'ACTIVO\', CONSTRAINT "UQ_81cfcc68b1e66cb5e504b0f37ba" UNIQUE ("permiso"), CONSTRAINT "CHK_permisos_id_permiso" CHECK ("id_permiso" > 0), CONSTRAINT "PK_76e2dbb965cd631705b6caaf698" PRIMARY KEY ("id_permiso"))',
    );
    await q.query(
      'CREATE TABLE "roles_permisos" ("updated_by" integer, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_rol" smallint NOT NULL, "id_permiso" integer NOT NULL, "created_by" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_roles_permisos_created_by" CHECK ("created_by" > 0), CONSTRAINT "CHK_roles_permisos_id_permiso" CHECK ("id_permiso" > 0), CONSTRAINT "CHK_roles_permisos_id_rol" CHECK ("id_rol" BETWEEN 1 AND 255), CONSTRAINT "PK_fcb2f452859724cbf5bbba72dfa" PRIMARY KEY ("id_rol", "id_permiso"))',
    );
    await q.query(
      'CREATE TABLE "usuarios_permisos" ("updated_by" integer, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_usuario" integer NOT NULL, "id_permiso" integer NOT NULL, "permitido" boolean NOT NULL DEFAULT true, "created_by" integer NOT NULL, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_usuarios_permisos_created_by" CHECK ("created_by" > 0), CONSTRAINT "CHK_usuarios_permisos_id_permiso" CHECK ("id_permiso" > 0), CONSTRAINT "CHK_usuarios_permisos_id_usuario" CHECK ("id_usuario" > 0), CONSTRAINT "PK_e34724373528405167f91b5e926" PRIMARY KEY ("id_usuario", "id_permiso"))',
    );
    await q.query(
      'CREATE TABLE "accesos_usuario" ("id_acceso" BIGSERIAL NOT NULL, "id_usuario" integer, "identificador_intento" character varying(150), "fecha_login" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "fecha_logout" TIMESTAMP WITH TIME ZONE, "ip" character varying(45), "user_agent" text, "login_exitoso" boolean NOT NULL DEFAULT true, "motivo_fallo" character varying(100), CONSTRAINT "CHK_accesos_usuario_id_usuario" CHECK ("id_usuario" > 0), CONSTRAINT "CHK_accesos_usuario_id_acceso" CHECK ("id_acceso" > 0), CONSTRAINT "PK_49e4dc8a85b1b8e67139980bca9" PRIMARY KEY ("id_acceso"))',
    );
    await q.query(
      'CREATE TABLE "configuracion_auditoria" ("created_by" integer, "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "id_configuracion" SERIAL NOT NULL, "codigo_evento" character varying(80) NOT NULL, "nombre" character varying(120) NOT NULL, "descripcion" character varying(255), "categoria" character varying(60) NOT NULL, "habilitado" boolean NOT NULL DEFAULT true, "es_obligatorio" boolean NOT NULL DEFAULT false, "updated_by" integer, "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "UQ_bab7d5b44431793179197addd4b" UNIQUE ("codigo_evento"), CONSTRAINT "CHK_configuracion_auditoria_updated_by" CHECK ("updated_by" > 0), CONSTRAINT "CHK_configuracion_auditoria_id_configuracion" CHECK ("id_configuracion" > 0), CONSTRAINT "PK_34b0fd2eacc84b01b0647a1ff91" PRIMARY KEY ("id_configuracion"))',
    );
    await q.query(
      'CREATE TABLE "auditoria" ("id_auditoria" BIGSERIAL NOT NULL, "id_usuario_accion" integer NOT NULL, "id_usuario_afectado" integer, "accion" character varying(80) NOT NULL, "entidad" character varying(60) NOT NULL, "id_registro" bigint, "descripcion" character varying(500), "ip" character varying(45), "user_agent" text, "fecha" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "CHK_auditoria_id_registro" CHECK ("id_registro" > 0), CONSTRAINT "CHK_auditoria_id_usuario_afectado" CHECK ("id_usuario_afectado" > 0), CONSTRAINT "CHK_auditoria_id_usuario_accion" CHECK ("id_usuario_accion" > 0), CONSTRAINT "CHK_auditoria_id_auditoria" CHECK ("id_auditoria" > 0), CONSTRAINT "PK_9c9ae9e15c3caf7d555c6b9f354" PRIMARY KEY ("id_auditoria"))',
    );
    await q.query(
      'ALTER TABLE "personas" ADD CONSTRAINT "FK_6a9901a1f248ea5495d8b8d9337" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "personas" ADD CONSTRAINT "FK_d82ab74d71e7444ff8b008aa7b7" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "pacientes" ADD CONSTRAINT "FK_db56c500b31531b85b055ad3408" FOREIGN KEY ("id_persona") REFERENCES "personas"("id_persona") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "pacientes" ADD CONSTRAINT "FK_faa39a25ec1a64c54f8b6a7de5e" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "pacientes" ADD CONSTRAINT "FK_14c1025616c2bdd4bf8e6e23e5a" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "usuarios" ADD CONSTRAINT "FK_5b29c4b5cc11b9c67c8b70c9cb2" FOREIGN KEY ("id_persona") REFERENCES "personas"("id_persona") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "usuarios" ADD CONSTRAINT "FK_98bf89ebf4b0be2d3825f54e56c" FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "usuarios" ADD CONSTRAINT "FK_487a730e7e9780f1e651b1ebfab" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "usuarios" ADD CONSTRAINT "FK_05be51999aab008d2908e4f3d93" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "personal" ADD CONSTRAINT "FK_858ef107116ae13a2709cd45f49" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "personal" ADD CONSTRAINT "FK_f72d1685a48865acbe7fb0bcb83" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "personal" ADD CONSTRAINT "FK_0c1f1f49b5d649cd7b95b243eef" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "roles" ADD CONSTRAINT "FK_4a39f3095781cdd9d6061afaae5" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "roles" ADD CONSTRAINT "FK_747b580d73db0ad78963d78b076" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "permisos" ADD CONSTRAINT "FK_62cb0356d09a546beadfffc5133" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "permisos" ADD CONSTRAINT "FK_4415e2dc9cbd254ffa9254b2a93" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "roles_permisos" ADD CONSTRAINT "FK_0ed8e17cba939bc2e754b87bce7" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "roles_permisos" ADD CONSTRAINT "FK_3eea35a03e553c991ac9662049f" FOREIGN KEY ("id_rol") REFERENCES "roles"("id_rol") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "roles_permisos" ADD CONSTRAINT "FK_89cfe42ff2e05a6a1784fdbe585" FOREIGN KEY ("id_permiso") REFERENCES "permisos"("id_permiso") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "roles_permisos" ADD CONSTRAINT "FK_16624fce035ffa52c7ff1572297" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "usuarios_permisos" ADD CONSTRAINT "FK_81639dd078ea23240d413998116" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "usuarios_permisos" ADD CONSTRAINT "FK_7f4b0232facc60400bde8066f55" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "usuarios_permisos" ADD CONSTRAINT "FK_b566a5ce9f5cf50cffdb21217a9" FOREIGN KEY ("id_permiso") REFERENCES "permisos"("id_permiso") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "usuarios_permisos" ADD CONSTRAINT "FK_8215e81678ab4e26596efeda3e7" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "accesos_usuario" ADD CONSTRAINT "FK_7eeb74f9e787c9b4bbd0f63b7ea" FOREIGN KEY ("id_usuario") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "configuracion_auditoria" ADD CONSTRAINT "FK_148297e72967e5172c0160e5021" FOREIGN KEY ("created_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "configuracion_auditoria" ADD CONSTRAINT "FK_2b7daf61e30583055a3cee079a8" FOREIGN KEY ("updated_by") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "auditoria" ADD CONSTRAINT "FK_35d555e853f208a84fee72262ea" FOREIGN KEY ("id_usuario_accion") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
    await q.query(
      'ALTER TABLE "auditoria" ADD CONSTRAINT "FK_af7b43a831d42ff83ad0eaa0115" FOREIGN KEY ("id_usuario_afectado") REFERENCES "usuarios"("id_usuario") ON DELETE RESTRICT ON UPDATE NO ACTION',
    );
  }
  async down(): Promise<void> {
    throw new Error(
      'No se revierte automaticamente: borraria tablas y registros.',
    );
  }
}
