import { IsOptional, IsString, MaxLength } from 'class-validator';

export class HandleWarningDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  handledNote?: string;
}
