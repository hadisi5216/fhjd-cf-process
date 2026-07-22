import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpdateProductDto {
  @IsOptional()
  @IsInt()
  rowNo?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  productName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  productModel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNo?: string;

  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  manufacturingProcess?: string;
}
