import { IsInt, IsPositive } from 'class-validator';

export class ProductProcessOwnerDto {
  @IsInt()
  @IsPositive()
  processStepId!: number;

  @IsInt()
  @IsPositive()
  personnelId!: number;
}
