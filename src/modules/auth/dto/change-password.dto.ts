import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ChangePasswordDto {
  @ApiProperty({ example: 'ClaveActual123!', format: 'password' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(72)
  contrasena_actual: string;

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
