import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreateRolDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(60)
  nombre: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;
}
