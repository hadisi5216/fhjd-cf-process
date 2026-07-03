import { IsInt, IsPositive } from 'class-validator';

export class ChangeProductProcessDto {
  @IsInt()
  @IsPositive()
  processStepId!: number;
}
