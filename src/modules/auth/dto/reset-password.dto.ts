import {
  IsString,
  Length,
  IsHexadecimal,
  MinLength,
  MaxLength,
} from 'class-validator';

export class ResetPasswordDto {
  @IsString()
  @Length(64, 64)
  @IsHexadecimal()
  token: string;

  @IsString()
  @MinLength(12)
  @MaxLength(72)
  nueva_contrasena: string;
}
