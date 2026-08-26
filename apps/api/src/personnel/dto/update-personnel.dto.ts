import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdatePersonnelDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  processStepId?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
