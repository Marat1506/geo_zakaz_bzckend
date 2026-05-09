import { IsEmail, Matches } from 'class-validator';

export class VerifyRegistrationDto {
  @IsEmail()
  email: string;

  @Matches(/^\d{6}$/, { message: 'Code must be 6 digits' })
  code: string;
}