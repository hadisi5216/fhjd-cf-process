import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductProcessOwnerDto } from './product-process-owner.dto';

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
  serialNo?: string | null;

  @IsOptional()
  @IsInt()
  @IsPositive()
  quantity?: number;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  unit?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string | null;

  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ProductProcessOwnerDto)
  processOwners!: ProductProcessOwnerDto[];
}
