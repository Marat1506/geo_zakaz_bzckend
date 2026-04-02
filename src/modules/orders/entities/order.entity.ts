import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
  VersionColumn,
} from 'typeorm';
import { OrderItem } from './order-item.entity';
import { ServiceZone } from '../../geo/entities/service-zone.entity';
import { User } from '../../auth/entities/user.entity';

export enum OrderStatus {
  PENDING_PAYMENT = 'pending_payment',
  PREPARING = 'preparing',
  ON_THE_WAY = 'on_the_way',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  ONLINE = 'online',
  CASH = 'cash',
}

@Entity('orders')
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_number', unique: true })
  orderNumber: string;

  @Column({ name: 'customer_id', nullable: true })
  customerId: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @Column({ name: 'total_amount', type: 'decimal', precision: 10, scale: 2 })
  totalAmount: number;

  @Column({
    type: 'enum',
    enum: OrderStatus,
    default: OrderStatus.PREPARING,
  })
  status: OrderStatus;

  @Column({
    name: 'payment_method',
    type: 'enum',
    enum: PaymentMethod,
  })
  paymentMethod: PaymentMethod;

  @Column({ name: 'payment_intent_id', nullable: true })
  paymentIntentId: string;

  @Column({ name: 'car_plate_number' })
  carPlateNumber: string;

  @Column({ name: 'car_color' })
  carColor: string;

  @Column({ name: 'parking_spot', nullable: true })
  parkingSpot: string;

  @Column({ name: 'car_photo_url' })
  carPhotoUrl: string;

  @Column({ name: 'estimated_time', type: 'integer' })
  estimatedTime: number;

  @Column({ name: 'zone_id', nullable: true })
  zoneId: string | null;

  @ManyToOne(() => ServiceZone, { nullable: true })
  @JoinColumn({ name: 'zone_id' })
  zone: ServiceZone | null;

  @Column({ name: 'seller_id', nullable: true })
  sellerId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'seller_id' })
  seller: User;

  @Column({ name: 'customer_lat', type: 'decimal', precision: 10, scale: 7, nullable: true })
  customerLat: number;

  @Column({ name: 'customer_lng', type: 'decimal', precision: 10, scale: 7, nullable: true })
  customerLng: number;

  @VersionColumn()
  version: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
