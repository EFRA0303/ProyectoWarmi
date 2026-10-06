import {
  IsInt,
  Min,
  IsNotEmpty,
  IsString,
  MaxLength,
  IsDateString,
  IsHexColor,
  IsOptional,
} from 'class-validator';

export class CreatePersonalDto {
  @IsInt()
  @Min(1)
  id_usuario: number;

  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  profesion: string;

  @IsNotEmpty()
  @IsString()
  @MaxLength(80)
  cargo: string;

  @IsDateString({ strict: true })
  fecha_ingreso: string;

  @IsOptional()
  @IsHexColor()
  color_agenda?: string;
}
