import { IsEmail, MaxLength, IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(150)
  correo_acceso: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(72)
  contrasena: string;
}
