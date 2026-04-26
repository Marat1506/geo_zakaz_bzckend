import {
  Injectable,
  InternalServerErrorException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ServiceZone, ZoneType } from './entities/service-zone.entity';
import { CreateServiceZoneDto } from './dto/create-service-zone.dto';
import { UpdateServiceZoneDto } from './dto/update-service-zone.dto';
import { User, UserRole } from '../auth/entities/user.entity';
import { Order, OrderStatus } from '../orders/entities/order.entity';

export interface GeoCheckResult {
  inZone: boolean;
  zoneId?: string;
  zoneName?: string;
  sellerId?: string;
  message?: string;
}

type ZoneMatch = {
  zone: ServiceZone;
  distanceMeters?: number;
};

@Injectable()
export class GeoService {
  constructor(
    @InjectRepository(ServiceZone)
    private readonly serviceZoneRepository: Repository<ServiceZone>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    private readonly dataSource: DataSource,
  ) { }

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

    const matches: ZoneMatch[] = [];

    // Check each zone (user is in zone if inside any)
    for (const zone of zones) {
      let isInside = false;
      let distanceMeters: number | undefined = undefined;

      if (zone.type === ZoneType.CIRCLE) {
        const centerLat = Number(zone.centerLat);
        const centerLng = Number(zone.centerLng);
        const radiusMeters = Number(zone.radiusMeters);
        if (!Number.isFinite(centerLat) || !Number.isFinite(centerLng) || !Number.isFinite(radiusMeters)) continue;
        distanceMeters = this.calculateDistance(lat, lng, centerLat, centerLng);
        isInside = distanceMeters <= radiusMeters;
      } else if (zone.type === ZoneType.POLYGON) {
        // Check polygon zone using PostGIS ST_Contains
        isInside = await this.checkPointInPolygon(lat, lng, zone.id);
      }

      if (isInside) {
        matches.push({ zone, distanceMeters });
      }
    }

    if (matches.length > 0) {
      // Deterministic resolution for overlapping zones:
      // 1) Prefer circular zones with smallest distance to center.
      // 2) Otherwise fallback to DB ordering from getActiveZones().
      const bestMatch = matches
        .slice()
        .sort((a, b) => {
          const aHasDistance = Number.isFinite(a.distanceMeters as number);
          const bHasDistance = Number.isFinite(b.distanceMeters as number);
          if (aHasDistance && bHasDistance) {
            return (a.distanceMeters as number) - (b.distanceMeters as number);
          }
          if (aHasDistance) return -1;
          if (bHasDistance) return 1;
          return 0;
        })[0];

      return {
        inZone: true,
        zoneId: bestMatch.zone.id,
        zoneName: bestMatch.zone.name,
        sellerId: bestMatch.zone.sellerId ?? undefined,
      };
    }

    return {
      inZone: false,
      message: "You're outside the service area",
    };
  }

  /** Returns zones filtered by role: seller sees only own zones, admin/superadmin see all */
  async getZones(user: User): Promise<ServiceZone[]> {
    if (user.role === UserRole.SELLER) {
      return this.serviceZoneRepository.find({ where: { sellerId: user.id } });
    }
    // admin/superadmin — return all
    return this.serviceZoneRepository.find();
  }

  /** Creates a zone — only sellers can create zones */
  async createZone(dto: CreateServiceZoneDto, user: User): Promise<ServiceZone> {
    if (user.role !== UserRole.SELLER) {
      throw new ForbiddenException('Только продавцы могут создавать зоны');
    }
    const zone = this.serviceZoneRepository.create({ ...dto, sellerId: user.id });
    return this.serviceZoneRepository.save(zone);
  }

  /** Updates a zone — only the seller who owns it can update */
  async updateZone(id: string, dto: UpdateServiceZoneDto, user: User): Promise<ServiceZone> {
    const zone = await this.serviceZoneRepository.findOne({ where: { id } });
    if (!zone) {
      throw new NotFoundException('Zone not found');
    }
    if (user.role !== UserRole.SELLER || zone.sellerId !== user.id) {
      throw new ForbiddenException('Вы можете редактировать только свои зоны');
    }

    const updateData = { ...dto };
    delete (updateData as any).sellerId;

    await this.serviceZoneRepository.update(id, updateData);
    return this.serviceZoneRepository.findOne({ where: { id } });
  }

  /** Deletes a zone — only the seller who owns it can delete */
  async deleteZone(id: string, user: User): Promise<void> {
    const zone = await this.serviceZoneRepository.findOne({ where: { id } });
    if (!zone) {
      throw new NotFoundException('Zone not found');
    }
    if (user.role !== UserRole.SELLER || zone.sellerId !== user.id) {
      throw new ForbiddenException('Вы можете удалять только свои зоны');
    }

    const activeOrders = await this.orderRepository.count({
      where: {
        zoneId: id,
        status: In([
          OrderStatus.PENDING_PAYMENT,
          OrderStatus.PREPARING,
          OrderStatus.ON_THE_WAY,
        ]),
      },
    });
    if (activeOrders > 0) {
      throw new ForbiddenException(
        `Нельзя удалить зону: в ней есть незакрытые заказы (${activeOrders}). Завершите или отмените их сначала.`,
      );
    }

    await this.deleteServiceZone(id);
  }

  /** Public method — returns all active zones without authentication */
  async getPublicZones(): Promise<ServiceZone[]> {
    return this.getActiveZones();
  }

  // ── Legacy methods kept for backward compatibility ──────────────────────────

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
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Clear references in orders (we keep orders for history)
      await queryRunner.query(
        'UPDATE orders SET zone_id = NULL WHERE zone_id = $1',
        [id],
      );

      // 2. Clear references in order_items for products we are about to delete
      // We keep order_items but decouple them from the menu_item record
      await queryRunner.query(
        'UPDATE order_items SET menu_item_id = NULL WHERE menu_item_id IN (SELECT id FROM menu_items WHERE zone_id = $1)',
        [id],
      );

      // 3. Delete products tied to this zone (as requested by user)
      await queryRunner.query(
        'DELETE FROM menu_items WHERE zone_id = $1',
        [id],
      );

      // 4. Finally delete the zone itself
      await queryRunner.query('DELETE FROM service_zones WHERE id = $1', [id]);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction().catch(() => { });
      const message =
        err instanceof Error ? err.message : 'Failed to delete zone';
      console.error('Error deleting zone:', err);
      throw new InternalServerErrorException(message);
    } finally {
      await queryRunner.release().catch(() => { });
    }
  }

  async getActiveZones(): Promise<ServiceZone[]> {
    // Get active zones from database
    const zones = await this.serviceZoneRepository.find({
      where: { active: true },
      order: { createdAt: 'ASC', id: 'ASC' },
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
