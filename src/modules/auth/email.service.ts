import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  async sendRegistrationCode(to: string, code: string): Promise<void> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY')?.trim();
    const from = this.configService.get<string>('RESEND_FROM_EMAIL')?.trim();

    if (!apiKey) {
      this.logger.error('RESEND_API_KEY is not set');
      throw new Error('RESEND_API_KEY is not set');
    }
    if (!from) {
      this.logger.error('RESEND_FROM_EMAIL is not set');
      throw new Error('RESEND_FROM_EMAIL is not set');
    }

    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: 'Your verification code',
      html: `<p>Your verification code is: <strong>${code}</strong></p><p>This code expires in 15 minutes.</p>`,
    });

    if (error) {
      this.logger.error(`Resend send failed: ${error.message}`);
      throw new Error(error.message);
    }

    this.logger.log(
      `Verification email sent (id=${data?.id ?? 'unknown'}, to=${to})`,
    );
  }
}
