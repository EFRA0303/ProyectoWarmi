import { IsInt, Min, IsOptional, IsBoolean } from 'class-validator';

export class AssignUserPermissionDto {
  @IsInt()
  @Min(1)
  id_usuario: number;

  @IsInt()
  @Min(1)
  id_permiso: number;

  @IsOptional()
  @IsBoolean()
  permitido?: boolean;
}
