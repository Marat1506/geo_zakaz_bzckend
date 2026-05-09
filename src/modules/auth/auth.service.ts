import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { EmailService } from './email.service';
import * as bcrypt from 'bcrypt';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import {
  averageDescriptors,
  euclideanDistance,
  FACE_EMBEDDING_DIM,
  isValidDescriptor,
} from './utils/face-embedding.util';

export interface CreateSellerDto {
  email: string;
  name: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string | null;
  refreshToken: string | null;
  requiresEmailVerification?: boolean;
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
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const email = loginDto.email.trim().toLowerCase();
    console.log('Login attempt for email:', email);

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      console.log('User not found:', email);
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.PENDING) {
      console.log('Login forbidden: account pending approval for', email);
      throw new UnauthorizedException('Your account is pending admin approval');
    }

    if (user.status === UserStatus.REJECTED) {
      console.log('Login forbidden: account rejected for', email);
      throw new UnauthorizedException('Your registration was rejected');
    }

    if (user.isBlocked) {
      console.log('Login forbidden: account blocked for', email);
      throw new UnauthorizedException('Your account is blocked');
    }

    console.log('User found, validating password...');
    const isPasswordValid = await user.validatePassword(loginDto.password);
    console.log('Password valid:', isPasswordValid);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (this.mustVerifyEmail(user)) {
      throw new UnauthorizedException('Please verify your email before signing in');
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

  async register(
    registerDto: RegisterDto,
    docs?: {
      passportMainUrl?: string | null;
      passportRegistrationUrl?: string | null;
      selfieUrl?: string | null;
    },
    faceDescriptors?: number[][] | null,
  ): Promise<AuthResponse> {
    if (!faceDescriptors || faceDescriptors.length < 2 || faceDescriptors.length > 5) {
      throw new BadRequestException(
        'Face verification required: send 2–5 samples in faceDescriptors',
      );
    }
    for (const d of faceDescriptors) {
      if (!isValidDescriptor(d)) {
        throw new BadRequestException(`Each face sample must be ${FACE_EMBEDDING_DIM} numbers`);
      }
    }

    const faceEmbedding = averageDescriptors(faceDescriptors);

    const email = registerDto.email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
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

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const emailVerificationCodeHash = await bcrypt.hash(code, 10);

    const user = this.userRepository.create({
      email,
      name: registerDto.name,
      phone: registerDto.phone,
      role: requestedRole,
      status,
      passwordHash: registerDto.password,
      passportMainUrl: docs?.passportMainUrl ?? null,
      passportRegistrationUrl: docs?.passportRegistrationUrl ?? null,
      selfieUrl: docs?.selfieUrl ?? null,
      faceEmbedding,
      emailVerifiedAt: null,
      emailVerificationCodeHash,
      emailVerificationExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });

    await this.userRepository.save(user);

    try {
      await this.emailService.sendRegistrationCode(email, code);
    } catch (err) {
      await this.userRepository.remove(user);
      this.logger.error(err);
      throw new BadRequestException(
        'Could not send verification email. Check email configuration and try again.',
      );
    }

    return {
      requiresEmailVerification: true,
      accessToken: null,
      refreshToken: null,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        phone: user.phone,
      },
    };
  }

  async verifyRegistrationEmail(dto: VerifyRegistrationDto): Promise<AuthResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new BadRequestException('Invalid or expired code');
    }
    if (user.emailVerifiedAt) {
      throw new BadRequestException('Email is already verified');
    }
    if (!user.emailVerificationCodeHash || !user.emailVerificationExpiresAt) {
      throw new BadRequestException('No pending verification for this account');
    }
    if (user.emailVerificationExpiresAt < new Date()) {
      throw new BadRequestException('Verification code has expired. Request a new one.');
    }
    const ok = await bcrypt.compare(dto.code, user.emailVerificationCodeHash);
    if (!ok) {
      throw new BadRequestException('Invalid or expired code');
    }

    user.emailVerifiedAt = new Date();
    user.emailVerificationCodeHash = null;
    user.emailVerificationExpiresAt = null;
    await this.userRepository.save(user);

    if (user.status === UserStatus.PENDING) {
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
      };
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

  async resendRegistrationCode(emailRaw: string): Promise<{ ok: true }> {
    const email = emailRaw.trim().toLowerCase();
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user || user.emailVerifiedAt || !this.mustVerifyEmail(user)) {
      return { ok: true };
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    user.emailVerificationCodeHash = await bcrypt.hash(code, 10);
    user.emailVerificationExpiresAt = new Date(Date.now() + 15 * 60 * 1000);
    await this.userRepository.save(user);

    try {
      await this.emailService.sendRegistrationCode(email, code);
    } catch (err) {
      this.logger.error(err);
      throw new BadRequestException('Could not send email. Try again later.');
    }
    return { ok: true };
  }

  async enrollFace(userId: string, descriptors: number[][]): Promise<{ success: boolean }> {
    if (!descriptors?.length || descriptors.length < 2 || descriptors.length > 5) {
      throw new BadRequestException('Provide between 2 and 5 face samples');
    }
    for (const d of descriptors) {
      if (!isValidDescriptor(d)) {
        throw new BadRequestException(`Each sample must be ${FACE_EMBEDDING_DIM} finite numbers`);
      }
    }

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Your account is pending admin approval');
    }
    if (user.status === UserStatus.REJECTED) {
      throw new UnauthorizedException('Your registration was rejected');
    }
    if (user.isBlocked) {
      throw new UnauthorizedException('Your account is blocked');
    }

    if (this.mustVerifyEmail(user)) {
      throw new UnauthorizedException('Please verify your email first');
    }

    user.faceEmbedding = averageDescriptors(descriptors);
    await this.userRepository.save(user);
    return { success: true };
  }

  async loginWithFace(email: string, descriptor: number[]): Promise<AuthResponse> {
    if (!isValidDescriptor(descriptor)) {
      throw new BadRequestException(`Face descriptor must be ${FACE_EMBEDDING_DIM} finite numbers`);
    }

    const user = await this.userRepository.findOne({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.faceEmbedding || user.faceEmbedding.length !== FACE_EMBEDDING_DIM) {
      throw new UnauthorizedException('Face login is not enabled for this account');
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Your account is pending admin approval');
    }

    if (user.status === UserStatus.REJECTED) {
      throw new UnauthorizedException('Your registration was rejected');
    }

    if (user.isBlocked) {
      throw new UnauthorizedException('Your account is blocked');
    }

    if (this.mustVerifyEmail(user)) {
      throw new UnauthorizedException('Please verify your email before signing in');
    }

    const threshold = Number(this.configService.get('FACE_MATCH_THRESHOLD') ?? 0.45);
    const dist = euclideanDistance(descriptor, user.faceEmbedding);
    if (dist > threshold) {
      this.logger.warn(
        `Face login (email): no match email=${email} dist=${dist.toFixed(4)} threshold=${threshold}`,
      );
      throw new UnauthorizedException('Face does not match');
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

  /**
   * Match face descriptor against all users with a stored embedding (1:N).
   * Uses ambiguity gap when two candidates are similarly close.
   */
  async loginWithFaceIdentify(descriptor: number[]): Promise<AuthResponse> {
    if (!isValidDescriptor(descriptor)) {
      throw new BadRequestException(`Face descriptor must be ${FACE_EMBEDDING_DIM} finite numbers`);
    }

    const threshold = Number(this.configService.get('FACE_MATCH_THRESHOLD') ?? 0.45);
    const ambiguityGap = Number(this.configService.get('FACE_AMBIGUITY_GAP') ?? 0.02);

    const users = await this.userRepository
      .createQueryBuilder('u')
      .where('u.face_embedding IS NOT NULL')
      .getMany();

    const scored = users
      .filter((u) => u.faceEmbedding && u.faceEmbedding.length === FACE_EMBEDDING_DIM)
      .map((u) => ({
        user: u,
        dist: euclideanDistance(descriptor, u.faceEmbedding as number[]),
      }))
      .sort((a, b) => a.dist - b.dist);

    if (scored.length === 0) {
      this.logger.warn('Face login (identify): no users with face_embedding');
      throw new UnauthorizedException(
        'No stored face profile — register with face verification first',
      );
    }

    const best = scored[0];
    if (best.dist > threshold) {
      this.logger.warn(
        `Face login (identify): under threshold bestDist=${best.dist.toFixed(4)} threshold=${threshold} candidates=${scored.length}`,
      );
      throw new UnauthorizedException('Face not recognized');
    }

    const second = scored[1];
    if (second && second.dist - best.dist < ambiguityGap) {
      this.logger.warn(
        `Face login (identify): ambiguous best=${best.dist.toFixed(4)} second=${second.dist.toFixed(4)} gap=${(second.dist - best.dist).toFixed(4)} minGap=${ambiguityGap}`,
      );
      throw new UnauthorizedException(
        'Match was ambiguous. Sign in with email and password, or try again.',
      );
    }

    const user = best.user;

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Your account is pending admin approval');
    }
    if (user.status === UserStatus.REJECTED) {
      throw new UnauthorizedException('Your registration was rejected');
    }
    if (user.isBlocked) {
      throw new UnauthorizedException('Your account is blocked');
    }

    if (this.mustVerifyEmail(user)) {
      throw new UnauthorizedException('Please verify your email before signing in');
    }

    this.logger.log(
      `Face login (identify): OK userId=${user.id} dist=${best.dist.toFixed(4)}`,
    );

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

      if (this.mustVerifyEmail(user)) {
        throw new UnauthorizedException('Please verify your email before signing in');
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

  async getSellers(): Promise<Partial<User>[]> {
    const sellers = await this.userRepository.find({
      where: { role: UserRole.SELLER },
      order: { createdAt: 'DESC' },
    });
    return sellers.map(s => ({
      id: s.id,
      email: s.email,
      name: s.name,
      phone: s.phone,
      status: s.status,
      isBlocked: s.isBlocked,
      createdAt: s.createdAt,
      passportMainUrl: s.passportMainUrl,
      passportRegistrationUrl: s.passportRegistrationUrl,
      selfieUrl: s.selfieUrl,
    }));
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
      emailVerifiedAt: new Date(),
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

  async updateSellerProfile(userId: string, dto: UpdateSellerProfileDto): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.role !== UserRole.SELLER) {
      throw new BadRequestException('Only sellers can update seller profile');
    }

    // Check if slug is unique
    if (dto.slug && dto.slug !== user.slug) {
      const existingSlug = await this.userRepository.findOne({ where: { slug: dto.slug } });
      if (existingSlug) {
        throw new ConflictException('This slug is already taken');
      }
    }

    // Update fields
    if (dto.shopName !== undefined) user.shopName = dto.shopName;
    if (dto.shopDescription !== undefined) user.shopDescription = dto.shopDescription;
    if (dto.shopLogo !== undefined) user.shopLogo = dto.shopLogo;
    if (dto.contactPhone !== undefined) user.contactPhone = dto.contactPhone;
    if (dto.contactEmail !== undefined) user.contactEmail = dto.contactEmail;
    if (dto.contactAddress !== undefined) user.contactAddress = dto.contactAddress;
    if (dto.slug !== undefined) user.slug = dto.slug;

    // Generate referral code if not exists
    if (!user.referralCode) {
      user.referralCode = this.generateReferralCode();
    }

    return this.userRepository.save(user);
  }

  async getSellerProfile(userId: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      shopName: user.shopName,
      shopDescription: user.shopDescription,
      shopLogo: user.shopLogo,
      contactPhone: user.contactPhone,
      contactEmail: user.contactEmail,
      contactAddress: user.contactAddress,
      slug: user.slug,
      referralCode: user.referralCode,
      referralVisits: user.referralVisits,
      referralOrders: user.referralOrders,
    };
  }

  async getSellerBySlug(slug: string): Promise<Partial<User>> {
    const user = await this.userRepository.findOne({
      where: { slug, role: UserRole.SELLER, status: UserStatus.APPROVED }
    });

    if (!user) {
      throw new NotFoundException('Seller not found');
    }

    // Increment referral visits
    user.referralVisits += 1;
    await this.userRepository.save(user);

    return {
      id: user.id,
      name: user.name,
      shopName: user.shopName,
      shopDescription: user.shopDescription,
      shopLogo: user.shopLogo,
      contactPhone: user.contactPhone,
      contactEmail: user.contactEmail,
      slug: user.slug,
    };
  }

  private generateReferralCode(): string {
    return Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  private mustVerifyEmail(user: User): boolean {
    if (user.role !== UserRole.CUSTOMER && user.role !== UserRole.SELLER) {
      return false;
    }
    return !user.emailVerifiedAt;
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
