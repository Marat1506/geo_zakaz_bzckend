import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AdminGuard } from '../auth/guards/admin.guard';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('carPhoto', {
      limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
      fileFilter: (req, file, cb) => {
        if (!file.mimetype.match(/^image\/(jpeg|png|jpg|webp|heic|heif)$/)) {
          return cb(
            new BadRequestException('Only images are allowed'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async createOrder(
    @Body() body: any,
    @UploadedFile() carPhoto: Express.Multer.File,
  ): Promise<Order> {
    if (!carPhoto) {
      throw new BadRequestException('Car photo is required');
    }

    // Parse items from JSON string if needed
    let items = body.items;
    if (typeof items === 'string') {
      try {
        items = JSON.parse(items);
      } catch (error) {
        throw new BadRequestException('Invalid items format');
      }
    }

    // Convert string numbers to actual numbers
    const customerLat = parseFloat(body.customerLat);
    const customerLng = parseFloat(body.customerLng);

    if (isNaN(customerLat) || isNaN(customerLng)) {
      throw new BadRequestException('Invalid coordinates');
    }

    const createOrderDto: CreateOrderDto = {
      items,
      carPlateNumber: body.carPlateNumber,
      carColor: body.carColor,
      parkingSpot: body.parkingSpot,
      customerLat,
      customerLng,
      paymentMethod: body.paymentMethod,
      customerId: body.customerId, // Add customerId from request
    };

    return this.ordersService.createOrder(createOrderDto, carPhoto);
  }

  @Get(':id')
  async getOrder(@Param('id') id: string): Promise<Order> {
    return this.ordersService.getOrder(id);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getOrders(
    @Query('status') status?: OrderStatus,
    @Query('zoneId') zoneId?: string,
  ): Promise<Order[]> {
    return this.ordersService.getOrders({ status, zoneId });
  }

  @Get('customer/my-orders')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(@Request() req: any): Promise<Order[]> {
    return this.ordersService.getOrdersByCustomer(req.user.sub);
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
  ): Promise<Order> {
    return this.ordersService.updateOrderStatus(id, updateStatusDto.status);
  }
}
