import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User, UserRole, UserStatus } from '../entities/user.entity';
import { Request as ExpressRequest } from 'express';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        ExtractJwt.fromAuthHeaderAsBearerToken(),
        (request: ExpressRequest) => {
          const rawCookie = request?.headers?.cookie;
          if (!rawCookie) {
            return null;
          }
          const tokenCookie = rawCookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('accessToken='));
          if (!tokenCookie) {
            return null;
          }
          return decodeURIComponent(tokenCookie.slice('accessToken='.length));
        },
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('jwt.secret'),
    });
  }

  async validate(payload: any): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (payload.tokenVersion !== undefined && payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException('Token has been invalidated');
    }

    if (user.status === UserStatus.PENDING) {
      throw new ForbiddenException('Your account is pending approval');
    }

    if (user.status === UserStatus.REJECTED) {
      throw new ForbiddenException('Your registration was rejected');
    }

    if (user.isBlocked) {
      throw new ForbiddenException('Your account is blocked');
    }

    if (
      (user.role === UserRole.CUSTOMER || user.role === UserRole.SELLER) &&
      !user.emailVerifiedAt
    ) {
      throw new ForbiddenException('Please verify your email');
    }

    return user;
  }
}
