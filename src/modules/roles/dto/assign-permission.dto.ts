import { IsInt, Min } from 'class-validator';

export class AssignPermissionDto {
  @IsInt()
  @Min(1)
  id_permiso: number;
}
