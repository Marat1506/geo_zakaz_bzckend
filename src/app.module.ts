import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import databaseConfig from './config/database.config';
import jwtConfig from './config/jwt.config';
import redisConfig from './config/redis.config';
import { AuthModule } from './modules/auth/auth.module';
import { GeoModule } from './modules/geo/geo.module';
import { MenuModule } from './modules/menu/menu.module';
import { FilesModule } from './modules/files/files.module';
import { OrdersModule } from './modules/orders/orders.module';
import { NotificationModule } from './modules/notifications/notification.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { QrCodeModule } from './modules/qrcode/qrcode.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [databaseConfig, jwtConfig, redisConfig],
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        configService.get('database'),
      inject: [ConfigService],
    }),
    AuthModule,
    GeoModule,
    MenuModule,
    FilesModule,
    OrdersModule,
    NotificationModule,
    ReviewsModule,
    QrCodeModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
