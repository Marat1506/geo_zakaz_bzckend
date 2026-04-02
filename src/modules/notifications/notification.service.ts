import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PushSubscription } from './entities/push-subscription.entity';

interface SubscribeDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

interface PushPayload {
  title: string;
  body: string;
  [key: string]: any;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private webPush: any = null;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly pushSubscriptionRepository: Repository<PushSubscription>,
    private readonly configService: ConfigService,
  ) {
    this.initWebPush();
  }

  private async initWebPush() {
    try {
      const webPushModule = await import('web-push');
      this.webPush = webPushModule.default ?? webPushModule;

      const publicKey = this.configService.get<string>('VAPID_PUBLIC_KEY');
      const privateKey = this.configService.get<string>('VAPID_PRIVATE_KEY');
      const email = this.configService.get<string>('VAPID_EMAIL', 'mailto:admin@example.com');

      if (publicKey && privateKey) {
        this.webPush.setVapidDetails(email, publicKey, privateKey);
        this.logger.log('Web Push initialized with VAPID keys');
      } else {
        this.logger.warn('VAPID keys not configured — push notifications disabled');
        this.webPush = null;
      }
    } catch (err) {
      this.logger.warn('web-push module not available — push notifications disabled');
      this.webPush = null;
    }
  }

  async subscribe(userId: string, dto: SubscribeDto): Promise<PushSubscription> {
    const existing = await this.pushSubscriptionRepository.findOne({
      where: { endpoint: dto.endpoint },
    });

    if (existing) {
      existing.userId = userId;
      existing.p256dh = dto.keys.p256dh;
      existing.auth = dto.keys.auth;
      return this.pushSubscriptionRepository.save(existing);
    }

    const subscription = this.pushSubscriptionRepository.create({
      userId,
      endpoint: dto.endpoint,
      p256dh: dto.keys.p256dh,
      auth: dto.keys.auth,
    });

    return this.pushSubscriptionRepository.save(subscription);
  }

  async unsubscribe(endpoint: string): Promise<void> {
    await this.pushSubscriptionRepository.delete({ endpoint });
  }

  async sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.webPush) {
      this.logger.debug('Push skipped — web-push not configured');
      return;
    }

    const subscriptions = await this.pushSubscriptionRepository.find({
      where: { userId },
    });

    const payloadStr = JSON.stringify(payload);

    for (const sub of subscriptions) {
      try {
        await this.webPush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          payloadStr,
        );
      } catch (err: any) {
        if (err.statusCode === 410) {
          // Subscription expired — remove it
          await this.pushSubscriptionRepository.delete({ endpoint: sub.endpoint });
          this.logger.log(`Removed expired push subscription: ${sub.endpoint}`);
        } else {
          this.logger.error(`Failed to send push to ${sub.endpoint}: ${err.message}`);
        }
      }
    }
  }

  getVapidPublicKey(): string {
    return this.configService.get<string>('VAPID_PUBLIC_KEY', '');
  }
}
