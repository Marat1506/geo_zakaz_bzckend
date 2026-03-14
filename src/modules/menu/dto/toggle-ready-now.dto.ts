import { IsBoolean } from 'class-validator';

export class ToggleReadyNowDto {
  @IsBoolean()
  readyNow: boolean;
}
