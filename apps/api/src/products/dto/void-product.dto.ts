import { IsString, MaxLength, MinLength } from 'class-validator';

export class VoidProductDto {
  @IsString()
  @MinLength(1, { message: '请输入作废原因' })
  @MaxLength(500, { message: '作废原因不能超过 500 个字符' })
  reason!: string;
}
