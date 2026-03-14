import { IsString, IsNumber, IsOptional, Length, Min } from 'class-validator';

export class CreateCategoryDto {
  @IsString()
  @Length(2, 50)
  name: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  order?: number;
}
