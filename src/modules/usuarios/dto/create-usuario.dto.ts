import {
  IsInt,
  Min,
  IsEmail,
  MaxLength,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

export class CreateUsuarioDto {
  @IsInt()
  @Min(1)
  id_persona: number;

  @IsInt()
  @Min(1)
  id_rol: number;

  @IsEmail()
  @MaxLength(150)
  correo_acceso: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  nombre_usuario?: string | null;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  contrasena: string;
}
