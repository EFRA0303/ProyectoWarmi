import { IsEmail, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({
    example: 'usuario@warmi.local',
    description: 'Correo de una cuenta activa.',
  })
  @IsEmail()
  @MaxLength(150)
  correo_acceso: string;
}
