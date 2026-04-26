import {
  IsString,
  IsNumber,
  IsBoolean,
  IsOptional,
  IsUUID,
  Length,
  Min,
  Max,
} from 'class-validator';

export class CreateMenuItemDto {
  @IsString()
  @Length(2, 100)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsNumber()
  @Min(0.01)
  @Max(999999.99)
  price: number;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsBoolean()
  readyNow: boolean;

  @IsBoolean()
  available: boolean;

  @IsNumber()
  @Min(1)
  @Max(120)
  preparationTime: number;

  @IsOptional()
  @IsString()
  @Length(1, 50)
  category?: string;

  @IsUUID()
  zoneId: string;
}
