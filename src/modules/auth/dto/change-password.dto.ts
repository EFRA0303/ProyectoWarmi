import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)
  contrasena_actual: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  nueva_contrasena: string;
}
