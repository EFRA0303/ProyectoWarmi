import {
  IsString,
  Length,
  IsHexadecimal,
  MinLength,
  MaxLength,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ResetPasswordDto {
  @ApiProperty({
    example: 'a'.repeat(64),
    minLength: 64,
    maxLength: 64,
    description:
      'Token recibido por correo; no es el hash almacenado en la base de datos.',
  })
  @IsString()
  @Length(64, 64)
  @IsHexadecimal()
  token: string;

  @ApiProperty({
    example: 'NuevaClave123!',
    minLength: 12,
    maxLength: 72,
    format: 'password',
  })
  @IsString()
  @MinLength(12)
  @MaxLength(72)
  nueva_contrasena: string;
}
