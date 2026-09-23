import { IsEmail, MaxLength, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({ example: 'usuario@warmi.local' })
  @IsEmail()
  @MaxLength(150)
  correo_acceso: string;

  @ApiProperty({ example: 'ClaveSegura123!', format: 'password' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)
  contrasena: string;
}
