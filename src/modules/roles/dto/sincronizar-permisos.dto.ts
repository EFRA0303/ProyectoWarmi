import { ArrayUnique, IsArray, IsInt, Min } from 'class-validator';

export class SincronizarPermisosDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  @Min(1, { each: true })
  id_permisos: number[];
}
