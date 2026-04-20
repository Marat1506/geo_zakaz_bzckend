import { IsString, IsInt, Min, Max, IsOptional, IsUUID } from 'class-validator';

export class CreateReviewDto {
  @IsUUID()
  menuItemId: string;

  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @IsOptional()
  @IsString()
  comment?: string;

  @IsOptional()
  @IsUUID()
  orderId?: string;
}
