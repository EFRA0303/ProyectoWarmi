// Clases base sin columnas. Los diagramas actuales no agregan timestamps
// generales a estas entidades; se conservan para compartir la estructura
// de los modelos de dominio recuperados sin alterar su esquema.
export abstract class CreatedEntity {}

export abstract class TimestampedEntity extends CreatedEntity {}
