import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-redis-yet';
import { GeoController } from './geo.controller';
import { GeoService } from './geo.service';
import { ServiceZone } from './entities/service-zone.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([ServiceZone]),
    CacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: configService.get('redis.host'),
            port: configService.get('redis.port'),
          },
          ttl: configService.get('redis.ttl') * 1000, // convert to milliseconds
        }),
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [GeoController],
  providers: [GeoService],
  exports: [GeoService],
})
export class GeoModule {}
