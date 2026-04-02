import {
  Controller,
  Post,
  Delete,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

class SubscribeDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

class UnsubscribeDto {
  endpoint: string;
}

@Controller('notifications')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @UseGuards(JwtAuthGuard)
  @Post('subscribe')
  subscribe(@Request() req, @Body() dto: SubscribeDto) {
    return this.notificationService.subscribe(req.user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('subscribe')
  unsubscribe(@Body() dto: UnsubscribeDto) {
    return this.notificationService.unsubscribe(dto.endpoint);
  }

  @Get('vapid-public-key')
  getVapidPublicKey() {
    return { publicKey: this.notificationService.getVapidPublicKey() };
  }
}
