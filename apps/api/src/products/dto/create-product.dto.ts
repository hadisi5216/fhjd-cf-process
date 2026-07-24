import {
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateProductDto {
  @IsOptional()
  @IsInt()
  rowNo?: number;

  @IsString()
  @MaxLength(100)
  productName!: string;

  @IsString()
  @MaxLength(120)
  productModel!: string;

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
}
