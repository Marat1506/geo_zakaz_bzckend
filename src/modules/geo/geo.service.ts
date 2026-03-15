import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ServiceZone, ZoneType } from './entities/service-zone.entity';
import { CreateServiceZoneDto } from './dto/create-service-zone.dto';
import { UpdateServiceZoneDto } from './dto/update-service-zone.dto';

export interface GeoCheckResult {
  inZone: boolean;
  zoneId?: string;
  zoneName?: string;
  message?: string;
}

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(ServiceZone)
    private readonly serviceZoneRepository: Repository<ServiceZone>,
    private readonly dataSource: DataSource,
  ) {}

  async checkLocation(lat: number, lng: number): Promise<GeoCheckResult> {
    // Validate coordinates
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return {
        inZone: false,
        message: 'Invalid coordinates',
      };
    }

    // Get active zones (with caching)
    const zones = await this.getActiveZones();

    if (zones.length === 0) {
      return {
        inZone: false,
        message: 'No service zones available',
      };
    }

    // Check each zone (support multiple zones: user is in zone if inside any)
    for (const zone of zones) {
      let isInside = false;

      if (zone.type === ZoneType.CIRCLE) {
        const centerLat = Number(zone.centerLat);
        const centerLng = Number(zone.centerLng);
        const radiusMeters = Number(zone.radiusMeters);
        if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(radiusMeters)) continue;
        const distance = this.calculateDistance(lat, lng, centerLat, centerLng);
        isInside = distance <= radiusMeters;
      } else if (zone.type === ZoneType.POLYGON) {
        // Check polygon zone using PostGIS ST_Contains
        isInside = await this.checkPointInPolygon(lat, lng, zone.id);
      }

      if (isInside) {
        return {
          inZone: true,
          zoneId: zone.id,
          zoneName: zone.name,
        };
      }
    }

    return {
      inZone: false,
      message: "You're outside the service area",
    };
  }

  async createServiceZone(
    zoneData: CreateServiceZoneDto,
  ): Promise<ServiceZone> {
    const zone = this.serviceZoneRepository.create(zoneData);
    const savedZone = await this.serviceZoneRepository.save(zone);
    return savedZone;
  }

  async updateServiceZone(
    id: string,
    zoneData: UpdateServiceZoneDto,
  ): Promise<ServiceZone> {
    await this.serviceZoneRepository.update(id, zoneData);
    const updatedZone = await this.serviceZoneRepository.findOne({
      where: { id },
    });
    return updatedZone;
  }

  async getServiceZones(): Promise<ServiceZone[]> {
    return this.serviceZoneRepository.find();
  }

  async getServiceZone(id: string): Promise<ServiceZone> {
    return this.serviceZoneRepository.findOne({ where: { id } });
  }

  async deleteServiceZone(id: string): Promise<void> {
    try {
      await this.dataSource.query(
        'ALTER TABLE orders ALTER COLUMN zone_id DROP NOT NULL',
      );
    } catch {
      // Column may already be nullable
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await queryRunner.query(
        'UPDATE orders SET zone_id = NULL WHERE zone_id = $1',
        [id],
      );
      await queryRunner.query(
        'UPDATE menu_items SET zone_id = NULL WHERE zone_id = $1',
        [id],
      );
      await queryRunner.query('DELETE FROM service_zones WHERE id = $1', [id]);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction().catch(() => {});
      const message =
        err instanceof Error ? err.message : 'Failed to delete zone';
      throw new InternalServerErrorException(message);
    } finally {
      await queryRunner.release().catch(() => {});
    }
  }

  async getActiveZones(): Promise<ServiceZone[]> {
    // Get active zones from database
    const zones = await this.serviceZoneRepository.find({
      where: { active: true },
    });

    return zones;
  }

  /**
   * Check if a point is inside a polygon using PostGIS
   */
  private async checkPointInPolygon(
    lat: number,
    lng: number,
    zoneId: string,
  ): Promise<boolean> {
    const result = await this.serviceZoneRepository.query(
      `SELECT ST_Contains(
        polygon_coordinates,
        ST_SetSRID(ST_MakePoint($1, $2), 4326)
      ) as is_inside
      FROM service_zones
      WHERE id = $3`,
      [lng, lat, zoneId],
    );

    return result[0]?.is_inside || false;
  }

  /**
   * Calculate distance between two points using Haversine formula
   * @returns distance in meters
   */
  private calculateDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371000; // Earth radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lng2 - lng1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }
}
