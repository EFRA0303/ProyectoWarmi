import { IsOptional, IsString, MaxLength } from 'class-validator';
export class BajaDto {
  @IsOptional() @IsString() @MaxLength(255) motivo_baja?: string;
}
