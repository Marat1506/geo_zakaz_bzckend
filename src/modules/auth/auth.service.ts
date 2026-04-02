import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

export interface CreateSellerDto {
  email: string;
  name: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    role: string;
    name?: string;
    phone?: string;
  };
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) { }

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    console.log('Login attempt for email:', loginDto.email);

    const user = await this.userRepository.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      console.log('User not found:', loginDto.email);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.PENDING) {
      console.log('Login forbidden: account pending approval for', loginDto.email);
      throw new UnauthorizedException('Ваш аккаунт ожидает одобрения администратора');
    }

    if (user.status === UserStatus.REJECTED) {
      console.log('Login forbidden: account rejected for', loginDto.email);
      throw new UnauthorizedException('Ваш запрос на регистрацию отклонен');
    }

    if (user.isBlocked) {
      console.log('Login forbidden: account blocked for', loginDto.email);
      throw new UnauthorizedException('Ваш аккаунт заблокирован');
    }

    console.log('User found, validating password...');
    const isPasswordValid = await user.validatePassword(loginDto.password);
    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
      },
    };
  }

  async register(registerDto: RegisterDto): Promise<AuthResponse> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: registerDto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    const requestedRole = registerDto.role || UserRole.CUSTOMER;
    // Only superadmin can register superadmins directly
    if (requestedRole === UserRole.SUPERADMIN) {
      throw new ConflictException('Invalid role');
    }

    const status = requestedRole === UserRole.SELLER ? UserStatus.PENDING : UserStatus.APPROVED;

    // Create new user
    const user = this.userRepository.create({
      email: registerDto.email,
      name: registerDto.name,
      phone: registerDto.phone,
      role: requestedRole,
      status: status,
      passwordHash: registerDto.password, // Will be hashed by @BeforeInsert
    });

    // Save user (password will be hashed automatically)
    await this.userRepository.save(user);

    // If seller, return empty tokens as an object to avoid frontend crashes
    if (status === UserStatus.PENDING) {
      console.log('Seller registration successful (pending approval):', user.email);
      return {
        accessToken: null,
        refreshToken: null,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          phone: user.phone,
        },
      } as any;
    }

    // Generate tokens
    const tokens = await this.generateTokens(user);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
      },
    };
  }

  async validateToken(token: string): Promise<User> {
    try {
      const payload = this.jwtService.verify(token, {
        secret: this.configService.get('jwt.secret'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      return user;
    } catch (error) {
      throw new UnauthorizedException('Invalid token');
    }
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('jwt.refreshSecret'),
      });

      const user = await this.userRepository.findOne({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      const tokens = await this.generateTokens(user);

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          name: user.name,
          phone: user.phone,
        },
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async getSellers(): Promise<User[]> {
    return this.userRepository.find({
      where: { role: UserRole.SELLER },
      order: { createdAt: 'DESC' },
    });
  }

  async approveSeller(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id, role: UserRole.SELLER } });
    if (!user) {
      throw new NotFoundException('Seller not found');
    }
    user.status = UserStatus.APPROVED;
    user.isBlocked = false;
    return this.userRepository.save(user);
  }

  async rejectSeller(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id, role: UserRole.SELLER } });
    if (!user) {
      throw new NotFoundException('Seller not found');
    }
    user.status = UserStatus.REJECTED;
    return this.userRepository.save(user);
  }

  async createSeller(dto: CreateSellerDto): Promise<User> {
    const existing = await this.userRepository.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const user = this.userRepository.create({
      email: dto.email,
      name: dto.name,
      role: UserRole.SELLER,
      status: UserStatus.APPROVED, // Admin created sellers are auto-approved
      passwordHash: dto.password, // hashed by @BeforeInsert
    });

    return this.userRepository.save(user);
  }

  async blockSeller(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isBlocked = true;
    user.tokenVersion = (user.tokenVersion ?? 0) + 1;
    return this.userRepository.save(user);
  }

  async unblockSeller(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    user.isBlocked = false;
    return this.userRepository.save(user);
  }

  private async generateTokens(user: User): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    const payload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.secret'),
      expiresIn: this.configService.get('jwt.expiresIn'),
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('jwt.refreshSecret'),
      expiresIn: this.configService.get('jwt.refreshExpiresIn'),
    });

    return {
      accessToken,
      refreshToken,
    };
  }
}
