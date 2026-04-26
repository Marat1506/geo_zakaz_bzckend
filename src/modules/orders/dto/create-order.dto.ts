import {
  IsArray,
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  ValidateNested,
  Length,
  Matches,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OrderItemDto } from './order-item.dto';
import { PaymentMethod } from '../entities/order.entity';

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @Length(2, 20)
  @Matches(/^[A-Z0-9-]+$/i)
  carPlateNumber: string;

  @IsOptional()
  @IsString()
  @Length(1, 20)
  parkingSpot?: string;

  @IsOptional()
  @IsString()
  carPhotoUrl?: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  customerLat: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  customerLng: number;

  @IsEnum(PaymentMethod)
  paymentMethod: PaymentMethod;
}
