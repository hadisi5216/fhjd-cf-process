import { IsBoolean, IsIn, IsOptional } from 'class-validator';

const SCREEN_LIST_FONT_SIZES = [
  'SMALL',
  'STANDARD',
  'LARGE',
  'EXTRA_LARGE',
] as const;

export class UpdateSettingsDto {
  @IsOptional()
  @IsBoolean()
  screenPreviewDataEnabled?: boolean;

  @IsOptional()
  @IsIn(SCREEN_LIST_FONT_SIZES)
  screenListFontSize?: (typeof SCREEN_LIST_FONT_SIZES)[number];
}
