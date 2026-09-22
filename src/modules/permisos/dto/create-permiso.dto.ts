import { IsNotEmpty, IsString, MaxLength, IsOptional } from 'class-validator';

export class CreatePermisoDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  permiso: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  descripcion?: string | null;
}
