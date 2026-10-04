import { MaxLength, IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class LoginDto {
  @ApiProperty({
    example: 'usuario@warmi.local',
    description: 'Correo de acceso o nombre de usuario',
  })
  @IsNotEmpty()
  @IsString()
  @MaxLength(150)
  correo_acceso: string;

  @ApiProperty({ example: 'ClaveSegura123!', format: 'password' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)
  contrasena: string;
}
