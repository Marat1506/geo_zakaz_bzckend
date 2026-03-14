import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum ZoneType {
  CIRCLE = 'circle',
  POLYGON = 'polygon',
}

@Entity('service_zones')
export class ServiceZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({
    type: 'enum',
    enum: ZoneType,
  })
  type: ZoneType;

  // For circle type
  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true, name: 'center_lat' })
  centerLat: number;

  @Column({ type: 'decimal', precision: 10, scale: 7, nullable: true, name: 'center_lng' })
  centerLng: number;

  @Column({ type: 'integer', nullable: true, name: 'radius_meters' })
  radiusMeters: number;

  // For polygon type (stored as GeoJSON)
  @Column({ type: 'jsonb', nullable: true, name: 'polygon_coordinates' })
  polygonCoordinates: any; // GeoJSON.Polygon

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
