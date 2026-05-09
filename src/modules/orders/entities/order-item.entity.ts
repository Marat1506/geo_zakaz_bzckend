import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';

@Entity('order_items')
export class OrderItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'order_id' })
  orderId: string;

  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  /** Null after the linked menu item (zone) was removed; name/price remain as snapshot. */
  @Column({ name: 'menu_item_id', nullable: true })
  menuItemId: string | null;

  @ManyToOne(() => MenuItem, { nullable: true })
  @JoinColumn({ name: 'menu_item_id' })
  menuItem: MenuItem | null;

  @Column({ name: 'menu_item_name' })
  menuItemName: string;

  @Column({ type: 'integer' })
  quantity: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  price: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  subtotal: number;
}
