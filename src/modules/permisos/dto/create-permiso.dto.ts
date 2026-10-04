import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  IsOptional,
} from 'class-validator';

export class CreatePermisoDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  @Matches(/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/, {
    message:
      'El permiso debe usar el formato modulo.accion en minusculas, sin espacios',
  })
  permiso: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;
}
