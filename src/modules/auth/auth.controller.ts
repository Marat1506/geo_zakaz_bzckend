import {
  Controller, Post, Get, Patch, Body, HttpCode, HttpStatus,
  UseGuards, Request, Param, UseInterceptors, UploadedFiles, BadRequestException, Req, Res,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { AuthService, AuthResponse, CreateSellerDto } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyRegistrationDto } from './dto/verify-registration.dto';
import { ResendRegistrationDto } from './dto/resend-registration.dto';
import { FaceLoginDto } from './dto/face-login.dto';
import { EnrollFaceDto } from './dto/enroll-face.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { UpdateSellerProfileDto } from './dto/update-seller-profile.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { Roles } from './decorators/roles.decorator';
import { UserRole } from './entities/user.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';
import { FilesService } from '../files/files.service';
import { QrCodeService } from '../qrcode/qrcode.service';
import { Request as ExpressRequest, Response } from 'express';
import { FACE_EMBEDDING_DIM, parseFaceDescriptorsJson } from './utils/face-embedding.util';

@Controller('auth')
export class AuthController {
  private shouldUseSecureCookies(): boolean {
    if (process.env.AUTH_COOKIE_SECURE === 'true') {
      return true;
    }
    if (process.env.AUTH_COOKIE_SECURE === 'false') {
      return false;
    }
    const frontendUrl =
      process.env.FRONTEND_URL || process.env.PUBLIC_FRONTEND_URL || '';
    return /^https:\/\//i.test(frontendUrl);
  }

  private getCookieOptions(maxAgeMs: number) {
    return {
      httpOnly: true,
      secure: this.shouldUseSecureCookies(),
      sameSite: 'lax' as const,
      path: '/',
      maxAge: maxAgeMs,
    };
  }

  private readCookie(req: ExpressRequest, cookieName: string): string | undefined {
    const rawCookie = req.headers.cookie;
    if (!rawCookie) {
      return undefined;
    }
    const cookie = rawCookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${cookieName}=`));
    if (!cookie) {
      return undefined;
    }
    return decodeURIComponent(cookie.slice(cookieName.length + 1));
  }

  private setAuthCookies(res: Response, auth: AuthResponse) {
    res.cookie('accessToken', auth.accessToken, this.getCookieOptions(60 * 60 * 1000));
    res.cookie('refreshToken', auth.refreshToken, this.getCookieOptions(7 * 24 * 60 * 60 * 1000));
    res.cookie('userRole', auth.user.role, {
      httpOnly: false,
      secure: this.shouldUseSecureCookies(),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 1000,
    });
  }

  private getFrontendBaseUrl(): string {
    const fallback =
      process.env.NODE_ENV === 'production' ? 'https://lotfood.ru' : 'http://localhost:3001';
    return (
      process.env.FRONTEND_URL ||
      process.env.PUBLIC_FRONTEND_URL ||
      fallback
    ).replace(/\/$/, '');
  }

  constructor(
    private readonly authService: AuthService,
    private readonly filesService: FilesService,
    private readonly qrCodeService: QrCodeService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) { }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'passportMain', maxCount: 1 },
    { name: 'passportRegistration', maxCount: 1 },
    { name: 'selfie', maxCount: 1 },
  ], { limits: { fileSize: 10 * 1024 * 1024 } }))
  async register(
    @Body() body: any,
    @UploadedFiles() files: {
      passportMain?: Express.Multer.File[];
      passportRegistration?: Express.Multer.File[];
      selfie?: Express.Multer.File[];
    },
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const registerDto: RegisterDto = {
      email: body.email,
      password: body.password,
      name: body.name,
      phone: body.phone,
      role: body.role as UserRole,
    };

    // For seller registration, documents are required
    if (registerDto.role === UserRole.SELLER) {
      if (!files?.passportMain?.[0] || !files?.passportRegistration?.[0] || !files?.selfie?.[0]) {
        throw new BadRequestException('Upload all required documents to register as a seller');
      }
    }

    // Upload documents if provided
    let passportMainUrl: string | null = null;
    let passportRegistrationUrl: string | null = null;
    let selfieUrl: string | null = null;

    if (files?.passportMain?.[0]) {
      const result = await this.filesService.uploadFile(files.passportMain[0], 'seller-docs');
      passportMainUrl = result.url;
    }
    if (files?.passportRegistration?.[0]) {
      const result = await this.filesService.uploadFile(files.passportRegistration[0], 'seller-docs');
      passportRegistrationUrl = result.url;
    }
    if (files?.selfie?.[0]) {
      const result = await this.filesService.uploadFile(files.selfie[0], 'seller-docs');
      selfieUrl = result.url;
    }

    const faceDescriptors = parseFaceDescriptorsJson(body.faceDescriptors);

    const auth = await this.authService.register(
      registerDto,
      { passportMainUrl, passportRegistrationUrl, selfieUrl },
      faceDescriptors,
    );

    if (auth.accessToken && auth.refreshToken) {
      this.setAuthCookies(res, auth);
    }

    return auth;
  }

  @Post('register/verify')
  @HttpCode(HttpStatus.OK)
  async verifyRegistration(
    @Body() dto: VerifyRegistrationDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const auth = await this.authService.verifyRegistrationEmail(dto);
    if (auth.accessToken && auth.refreshToken) {
      this.setAuthCookies(res, auth);
    }
    return auth;
  }

  @Post('register/resend-code')
  @HttpCode(HttpStatus.OK)
  async resendRegistrationCode(@Body() dto: ResendRegistrationDto): Promise<{ ok: true }> {
    return this.authService.resendRegistrationCode(dto.email);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const auth = await this.authService.login(loginDto);
    this.setAuthCookies(res, auth);
    return auth;
  }

  @Post('face/login')
  @HttpCode(HttpStatus.OK)
  async faceLogin(
    @Body() dto: FaceLoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const auth = dto.email?.trim()
      ? await this.authService.loginWithFace(dto.email.trim().toLowerCase(), dto.descriptor)
      : await this.authService.loginWithFaceIdentify(dto.descriptor);
    this.setAuthCookies(res, auth);
    return auth;
  }

  @Post('face/enroll')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async enrollFace(@Request() req: any, @Body() dto: EnrollFaceDto) {
    return this.authService.enrollFace(req.user.id, dto.descriptors);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() refreshTokenDto: Partial<RefreshTokenDto>,
    @Req() req: ExpressRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const tokenFromBody = refreshTokenDto?.refreshToken;
    const tokenFromCookie = this.readCookie(req, 'refreshToken');
    const refreshToken = tokenFromBody || tokenFromCookie;

    if (!refreshToken) {
      throw new BadRequestException('Refresh token is required');
    }

    const auth = await this.authService.refreshToken(refreshToken);
    this.setAuthCookies(res, auth);
    return auth;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response): Promise<{ success: true }> {
    res.clearCookie('accessToken', { path: '/' });
    res.clearCookie('refreshToken', { path: '/' });
    res.clearCookie('userRole', { path: '/' });
    return { success: true };
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Request() req: any) {
    const user = await this.userRepository.findOne({ where: { id: req.user.id } });
    if (!user) return null;
    const hasFaceLogin =
      Array.isArray(user.faceEmbedding) && user.faceEmbedding.length === FACE_EMBEDDING_DIM;
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      hasFaceLogin,
      emailVerified: !!user.emailVerifiedAt,
    };
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req: any, @Body() body: { name?: string; phone?: string }) {
    const user = await this.userRepository.findOne({ where: { id: req.user.id } });
    if (!user) return null;
    if (body.name !== undefined) user.name = body.name;
    if (body.phone !== undefined) user.phone = body.phone;
    await this.userRepository.save(user);
    return { id: user.id, email: user.email, name: user.name, phone: user.phone, role: user.role };
  }

  @Get('sellers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async getSellers() {
    return this.authService.getSellers();
  }

  @Post('sellers')
  @HttpCode(HttpStatus.CREATED)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async createSeller(@Body() dto: CreateSellerDto) {
    return this.authService.createSeller(dto);
  }

  @Patch('sellers/:id/block')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async blockSeller(@Param('id') id: string) {
    return this.authService.blockSeller(id);
  }

  @Patch('sellers/:id/unblock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async unblockSeller(@Param('id') id: string) {
    return this.authService.unblockSeller(id);
  }

  @Patch('sellers/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async approveSeller(@Param('id') id: string) {
    return this.authService.approveSeller(id);
  }

  @Patch('sellers/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPERADMIN)
  async rejectSeller(@Param('id') id: string) {
    return this.authService.rejectSeller(id);
  }

  // Seller profile endpoints
  @Get('seller/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async getSellerProfile(@Request() req: any) {
    return this.authService.getSellerProfile(req.user.id);
  }

  @Patch('seller/profile')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async updateSellerProfile(@Request() req: any, @Body() dto: UpdateSellerProfileDto) {
    return this.authService.updateSellerProfile(req.user.id, dto);
  }

  // Public endpoint for referral links
  @Get('seller/slug/:slug')
  async getSellerBySlug(@Param('slug') slug: string) {
    return this.authService.getSellerBySlug(slug);
  }

  // Generate business card with QR code
  @Get('seller/business-card')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async generateBusinessCard(@Request() req: any) {
    const user = await this.userRepository.findOne({ where: { id: req.user.id } });
    if (!user || !user.slug) {
      throw new BadRequestException('Please set up your shop profile and slug first');
    }

    const html = await this.qrCodeService.generateBusinessCard({
      name: user.name,
      shopName: user.shopName,
      shopDescription: user.shopDescription,
      shopLogo: user.shopLogo,
      contactPhone: user.contactPhone,
      contactEmail: user.contactEmail,
      slug: user.slug,
    });

    return { html };
  }

  // Get QR code only
  @Get('seller/qr-code')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER)
  async getQRCode(@Request() req: any) {
    const user = await this.userRepository.findOne({ where: { id: req.user.id } });
    if (!user || !user.slug) {
      throw new BadRequestException('Please set up your slug first');
    }

    const referralUrl = `${this.getFrontendBaseUrl()}/ref/${user.slug}`;
    const qrCode = await this.qrCodeService.generateQRCode(referralUrl);

    return { qrCode, referralUrl };
  }
}
