import { IsArray, IsInt, IsOptional, Min } from 'class-validator';

export class UpdatePromptConfigDto {
  @IsOptional()
  @IsArray()
  basePrompt?: string[];

  @IsOptional()
  @IsArray()
  sourcesPrompt?: string[];

  @IsOptional()
  @IsArray()
  topicsPrompt?: string[];

  @IsOptional()
  @IsArray()
  personsPrompt?: string[];

  @IsOptional()
  @IsInt()
  @Min(1)
  chunkSize?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  overlapPages?: number;
}
