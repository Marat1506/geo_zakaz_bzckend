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
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderStatusDto } from './dto/update-order-status.dto';
import { Order, OrderStatus } from './entities/order.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER)
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
    @Request() req: any,
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

    const createOrderDto = plainToInstance(CreateOrderDto, {
      items,
      carPlateNumber: body.carPlateNumber,
      parkingSpot: body.parkingSpot,
      customerLat,
      customerLng,
      paymentMethod: body.paymentMethod,
    });

    const validationErrors = validateSync(createOrderDto, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    if (validationErrors.length > 0) {
      const messages = validationErrors.flatMap((error) =>
        error.constraints ? Object.values(error.constraints) : [`Invalid field: ${error.property}`],
      );
      throw new BadRequestException(messages);
    }

    return this.ordersService.createOrder(createOrderDto, carPhoto, req.user.id);
  }

  @Get('admin/list')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPERADMIN)
  async getOrders(
    @Request() req: any,
    @Query('status') status?: OrderStatus,
    @Query('zoneId') zoneId?: string,
  ): Promise<Order[]> {
    return this.ordersService.getOrders(req.user, { status, zoneId });
  }

  @Get('customer/my-orders')
  @UseGuards(JwtAuthGuard)
  async getMyOrders(@Request() req: any): Promise<Order[]> {
    return this.ordersService.getOrdersByCustomer(req.user.id);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.CUSTOMER, UserRole.SELLER, UserRole.ADMIN, UserRole.SUPERADMIN)
  async getOrder(@Param('id') id: string, @Request() req: any): Promise<Order> {
    return this.ordersService.getOrderForUser(id, req.user);
  }

  @Patch('admin/:id/status')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.ADMIN, UserRole.SUPERADMIN)
  async updateOrderStatus(
    @Param('id') id: string,
    @Body() updateStatusDto: UpdateOrderStatusDto,
    @Request() req: any,
  ): Promise<Order> {
    return this.ordersService.updateOrderStatus(id, updateStatusDto.status, req.user);
  }
}
