import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { GeoService, GeoCheckResult } from './geo.service';
import { CheckLocationDto } from './dto/check-location.dto';
import { CreateServiceZoneDto } from './dto/create-service-zone.dto';
import { UpdateServiceZoneDto } from './dto/update-service-zone.dto';
import { ServiceZone } from './entities/service-zone.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('geo')
export class GeoController {
  constructor(private readonly geoService: GeoService) {}

  @Post('check')
  async checkLocation(
    @Body() checkLocationDto: CheckLocationDto,
  ): Promise<GeoCheckResult> {
    return this.geoService.checkLocation(
      checkLocationDto.lat,
      checkLocationDto.lng,
    );
  }

  @Get('admin/zones')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getZones(): Promise<ServiceZone[]> {
    return this.geoService.getServiceZones();
  }

  @Post('admin/zones')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createZone(
    @Body() createZoneDto: CreateServiceZoneDto,
  ): Promise<ServiceZone> {
    console.log('Received zone creation request:', JSON.stringify(createZoneDto, null, 2));
    return this.geoService.createServiceZone(createZoneDto);
  }

  @Patch('admin/zones/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateZone(
    @Param('id') id: string,
    @Body() updateZoneDto: UpdateServiceZoneDto,
  ): Promise<ServiceZone> {
    return this.geoService.updateServiceZone(id, updateZoneDto);
  }

  @Delete('admin/zones/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteZone(@Param('id') id: string): Promise<void> {
    return this.geoService.deleteServiceZone(id);
  }
}
