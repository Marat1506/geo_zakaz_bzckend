import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ServiceZone } from '../../geo/entities/service-zone.entity';

@Entity('menu_items')
export class MenuItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ name: 'image_url', nullable: true })
  imageUrl: string;

  @Column({ name: 'ready_now', default: false })
  readyNow: boolean;

  @Column({ default: true })
  available: boolean;

  @Column({ name: 'preparation_time', type: 'integer' })
  preparationTime: number;

  @Column({ length: 50, nullable: true })
  category: string;

  @Column({ name: 'zone_id' })
  zoneId: string;

  @ManyToOne(() => ServiceZone, { nullable: false })
  @JoinColumn({ name: 'zone_id' })
  zone: ServiceZone;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
