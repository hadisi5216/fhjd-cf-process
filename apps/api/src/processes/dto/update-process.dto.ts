import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class UpdateProcessDto {
  @IsOptional()
  @IsString()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  sortOrder?: number;

  @IsOptional()
  @IsInt()
  timeoutHours?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
