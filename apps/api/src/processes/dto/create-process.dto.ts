import { IsBoolean, IsInt, IsOptional, IsPositive, IsString, MaxLength } from 'class-validator';

export class CreateProcessDto {
  @IsString()
  @MaxLength(50)
  name!: string;

  @IsInt()
  @IsPositive()
  sortOrder!: number;

  @IsOptional()
  @IsInt()
  timeoutHours?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
