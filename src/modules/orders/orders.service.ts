import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Order, OrderStatus, PaymentMethod } from './entities/order.entity';
import { OrderItem } from './entities/order-item.entity';
import { CreateOrderDto } from './dto/create-order.dto';
import { GeoService } from '../geo/geo.service';
import { MenuService } from '../menu/menu.service';
import { FilesService } from '../files/files.service';
import { User, UserRole } from '../auth/entities/user.entity';
import { NotificationGateway } from '../notifications/notification.gateway';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(OrderItem)
    private readonly orderItemRepository: Repository<OrderItem>,
    private readonly geoService: GeoService,
    private readonly menuService: MenuService,
    private readonly filesService: FilesService,
    private readonly dataSource: DataSource,
    private readonly notificationGateway: NotificationGateway,
    private readonly notificationService: NotificationService,
  ) {}

  async createOrder(
    orderData: CreateOrderDto,
    carPhoto: Express.Multer.File,
  ): Promise<Order> {
    // Check geolocation
    const geoCheck = await this.geoService.checkLocation(
      orderData.customerLat,
      orderData.customerLng,
    );

    if (!geoCheck.inZone) {
      throw new ForbiddenException(
        geoCheck.message || "You're outside the service area",
      );
    }

    // Upload car photo
    const carPhotoResult = await this.filesService.uploadFile(
      carPhoto,
      'car-photos',
    );

    // Get menu items and validate
    const menuItemIds = orderData.items.map((item) => item.menuItemId);
    const menuItems = await Promise.all(
      menuItemIds.map((id) => this.menuService.getMenuItem(id)),
    );

    // Validate all items belong to the same zone
    const itemZoneIds = new Set(menuItems.map((mi) => mi.zoneId));
    if (itemZoneIds.size > 1) {
      throw new BadRequestException('Все товары должны быть из одной зоны');
    }
    // Also verify items belong to the detected zone
    if (itemZoneIds.size === 1) {
      const itemZoneId = [...itemZoneIds][0];
      if (itemZoneId && geoCheck.zoneId && itemZoneId !== geoCheck.zoneId) {
        throw new BadRequestException('Все товары должны быть из одной зоны');
      }
    }

    // Calculate order items and total
    const orderItems: Partial<OrderItem>[] = [];
    let totalAmount = 0;

    for (const itemDto of orderData.items) {
      const menuItem = menuItems.find((mi) => mi.id === itemDto.menuItemId);

      if (!menuItem) {
        throw new NotFoundException(
          `Menu item ${itemDto.menuItemId} not found`,
        );
      }

      if (!menuItem.available) {
        throw new BadRequestException(
          `Item ${menuItem.name} is not available`,
        );
      }

      const subtotal = Number(menuItem.price) * itemDto.quantity;
      totalAmount += subtotal;

      orderItems.push({
        menuItemId: menuItem.id,
        menuItemName: menuItem.name,
        quantity: itemDto.quantity,
        price: Number(menuItem.price),
        subtotal,
      });
    }

    // Calculate ETA
    const estimatedTime = this.calculateETA(orderItems, menuItems);

    // Generate order number
    const orderNumber = await this.generateOrderNumber();

    // Create order in transaction
    const order = await this.dataSource.transaction(async (manager) => {
      const newOrder = manager.create(Order, {
        orderNumber,
        totalAmount,
        status:
          orderData.paymentMethod === PaymentMethod.CASH
            ? OrderStatus.PREPARING
            : OrderStatus.PENDING_PAYMENT,
        paymentMethod: orderData.paymentMethod,
        carPlateNumber: orderData.carPlateNumber,
        carColor: orderData.carColor,
        parkingSpot: orderData.parkingSpot,
        carPhotoUrl: carPhotoResult.url,
        estimatedTime,
        zoneId: geoCheck.zoneId,
        sellerId: geoCheck.sellerId,
        customerLat: orderData.customerLat,
        customerLng: orderData.customerLng,
        customerId: orderData.customerId,
      });

      const savedOrder = await manager.save(Order, newOrder);

      // Create order items
      for (const item of orderItems) {
        const orderItem = manager.create(OrderItem, {
          ...item,
          orderId: savedOrder.id,
        });
        await manager.save(OrderItem, orderItem);
      }

      return savedOrder;
    });

    // Load order with items
    const savedOrder = await this.getOrder(order.id);

    // Notify seller about new order
    if (geoCheck.sellerId) {
      this.notificationGateway.emitNewOrder(geoCheck.sellerId, savedOrder);
      this.notificationService
        .sendPushToUser(geoCheck.sellerId, {
          title: 'Новый заказ',
          body: `Новый заказ #${savedOrder.orderNumber} на сумму ${savedOrder.totalAmount}`,
        })
        .catch(() => {});
    }

    return savedOrder;
  }

  async getOrder(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({
      where: { id },
      relations: ['items', 'items.menuItem', 'zone'],
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    return order;
  }

  async getOrders(
    user?: User,
    filters?: {
      status?: OrderStatus;
      zoneId?: string;
    },
  ): Promise<Order[]> {
    const query = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .leftJoinAndSelect('items.menuItem', 'menuItem')
      .leftJoinAndSelect('order.zone', 'zone')
      .leftJoinAndSelect('order.seller', 'seller')
      .orderBy('order.createdAt', 'DESC');

    // Seller sees only their own orders
    if (user?.role === UserRole.SELLER) {
      query.andWhere('order.sellerId = :sellerId', { sellerId: user.id });
    }

    if (filters?.status) {
      query.andWhere('order.status = :status', { status: filters.status });
    }

    if (filters?.zoneId) {
      query.andWhere('order.zoneId = :zoneId', { zoneId: filters.zoneId });
    }

    return query.getMany();
  }

  async getOrdersByCustomer(customerId: string): Promise<Order[]> {
    return this.orderRepository.find({
      where: { customerId },
      relations: ['items', 'items.menuItem', 'zone'],
      order: { createdAt: 'DESC' },
    });
  }

  async updateOrderStatus(
    id: string,
    status: OrderStatus,
    user?: User,
  ): Promise<Order> {
    const order = await this.getOrder(id);

    // Only the seller who owns the order can update its status
    if (user?.role === UserRole.SELLER || user?.role === UserRole.ADMIN) {
      if (order.sellerId !== user.id) {
        throw new ForbiddenException(
          'Вы можете обновлять статус только своих заказов',
        );
      }
    }

    try {
      order.status = status;
      const updatedOrder = await this.orderRepository.save(order);

      // Emit WebSocket event
      this.notificationGateway.emitOrderStatusChanged(id, status);

      // Send push to customer for relevant statuses
      if (order.customerId) {
        if (status === OrderStatus.ON_THE_WAY) {
          this.notificationService
            .sendPushToUser(order.customerId, {
              title: 'Заказ в пути',
              body: 'Ваш заказ в пути',
            })
            .catch(() => {});
        } else if (status === OrderStatus.DELIVERED) {
          this.notificationService
            .sendPushToUser(order.customerId, {
              title: 'Заказ доставлен',
              body: 'Ваш заказ доставлен',
            })
            .catch(() => {});
        }
      }

      return updatedOrder;
    } catch (error) {
      if (error.name === 'OptimisticLockVersionMismatchError') {
        throw new ConflictException(
          'Order status was updated by another user',
        );
      }
      throw error;
    }
  }

  async cancelOrder(id: string): Promise<Order> {
    return this.updateOrderStatus(id, OrderStatus.CANCELLED);
  }

  private calculateETA(
    orderItems: Partial<OrderItem>[],
    menuItems: any[],
  ): number {
    let allReadyNow = true;
    let maxPreparationTime = 0;

    for (const item of orderItems) {
      const menuItem = menuItems.find((mi) => mi.id === item.menuItemId);
      if (menuItem) {
        if (!menuItem.readyNow) {
          allReadyNow = false;
          maxPreparationTime = Math.max(
            maxPreparationTime,
            menuItem.preparationTime,
          );
        }
      }
    }

    if (allReadyNow) {
      return 3; // 3 minutes for ready now items
    }

    return maxPreparationTime + 2; // Add 2 minutes for delivery
  }

  private async generateOrderNumber(): Promise<string> {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    // Get count of orders today
    const count = await this.orderRepository
      .createQueryBuilder('order')
      .where("order.orderNumber LIKE :pattern", {
        pattern: `ORD-${dateStr}-%`,
      })
      .getCount();

    const sequence = (count + 1).toString().padStart(4, '0');

    return `ORD-${dateStr}-${sequence}`;
  }
}
