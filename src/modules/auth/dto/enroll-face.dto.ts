import { IsArray, ArrayMinSize, ArrayMaxSize } from 'class-validator';

/** Each inner array must be a 128-float face descriptor (validated in service). */
export class EnrollFaceDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(5)
  descriptors: number[][];
}
