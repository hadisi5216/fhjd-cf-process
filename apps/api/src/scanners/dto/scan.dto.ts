import { IsOptional, IsString } from 'class-validator';

export class ScanDto {
  @IsOptional()
  @IsString()
  scannerCode?: string;

  @IsOptional()
  @IsString()
  scannerName?: string;

  @IsOptional()
  @IsString()
  content?: string;

  @IsOptional()
  @IsString()
  productModel?: string;

  @IsOptional()
  @IsString()
  scanTime?: string;
}
