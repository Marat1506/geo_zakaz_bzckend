import {
  IsString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsObject,
  Min,
  Max,
  Length,
  ValidateIf,
} from 'class-validator';
import { ZoneType } from '../entities/service-zone.entity';

export class CreateServiceZoneDto {
  @IsString()
  @Length(3, 100)
  name: string;

  @IsEnum(ZoneType)
  type: ZoneType;

  // For circle type
  @ValidateIf((o) => o.type === ZoneType.CIRCLE)
  @IsNumber()
  @Min(-90)
  @Max(90)
  centerLat?: number;

  @ValidateIf((o) => o.type === ZoneType.CIRCLE)
  @IsNumber()
  @Min(-180)
  @Max(180)
  centerLng?: number;

  @ValidateIf((o) => o.type === ZoneType.CIRCLE)
  @IsNumber()
  @Min(1)
  @Max(50000)
  radiusMeters?: number;

  // For polygon type
  @ValidateIf((o) => o.type === ZoneType.POLYGON)
  @IsObject()
  polygonCoordinates?: any; // GeoJSON.Polygon
}
