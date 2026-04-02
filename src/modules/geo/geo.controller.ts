import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { GeoService, GeoCheckResult } from './geo.service';
import { CheckLocationDto } from './dto/check-location.dto';
import { CreateServiceZoneDto } from './dto/create-service-zone.dto';
import { UpdateServiceZoneDto } from './dto/update-service-zone.dto';
import { ServiceZone } from './entities/service-zone.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  // ── Public endpoint — no guard ──────────────────────────────────────────────

  @Post('check')
  async checkLocation(
    @Body() checkLocationDto: CheckLocationDto,
  ): Promise<GeoCheckResult> {
    return this.geoService.checkLocation(
      checkLocationDto.lat,
      checkLocationDto.lng,
    );
  }

  @Get('zones/public')
  async getPublicZones(): Promise<ServiceZone[]> {
    return this.geoService.getPublicZones();
  }

  // ── Authenticated endpoints ─────────────────────────────────────────────────

  @Get('zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async getZones(@Request() req): Promise<ServiceZone[]> {
    return this.geoService.getZones(req.user);
  }

  @Post('zones')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN, UserRole.ADMIN)
  async createZone(
    @Body() createZoneDto: CreateServiceZoneDto,
    @Request() req,
  ): Promise<ServiceZone> {
    return this.geoService.createZone(createZoneDto, req.user);
  }

  @Patch('zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN, UserRole.ADMIN)
  async updateZone(
    @Param('id') id: string,
    @Body() updateZoneDto: UpdateServiceZoneDto,
    @Request() req,
  ): Promise<ServiceZone> {
    return this.geoService.updateZone(id, updateZoneDto, req.user);
  }

  @Delete('zones/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN, UserRole.ADMIN)
  async deleteZone(@Param('id') id: string, @Request() req): Promise<void> {
    return this.geoService.deleteZone(id, req.user);
  }
}
