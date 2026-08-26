import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePersonnelDto {
  @IsString()
  @MaxLength(50)
  name!: string;

  @IsInt()
  @IsPositive()
  processStepId!: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
