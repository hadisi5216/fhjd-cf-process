import { IsBoolean, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateScannerDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  ipAddress?: string;

  @IsOptional()
  @IsInt()
  processStepId?: number;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  location?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
