import {
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ProductProcessOwnerDto } from './product-process-owner.dto';

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
  @MaxLength(160)
  trackingCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  serialNo?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string | null;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductProcessOwnerDto)
  processOwners?: ProductProcessOwnerDto[];
}
