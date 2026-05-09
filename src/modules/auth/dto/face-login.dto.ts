import {
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
  IsEmail,
  IsNumber,
  IsOptional,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class FaceLoginDto {
  /** If omitted, server finds the best matching user among all face profiles (1:N). */
  @IsOptional()
  @Transform(({ value }) => (value === '' || value === undefined ? undefined : value))
  @IsEmail()
  email?: string;

  @IsArray()
  @ArrayMinSize(128)
  @ArrayMaxSize(128)
  @IsNumber({}, { each: true })
  descriptor: number[];
}
