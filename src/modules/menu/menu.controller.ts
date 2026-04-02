import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  Request,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { MenuService, MenuResponse } from './menu.service';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { ToggleReadyNowDto } from './dto/toggle-ready-now.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { FilesService } from '../files/files.service';

@Controller('menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly filesService: FilesService,
  ) { }

  // ── Public endpoints ────────────────────────────────────────────────────────

  /** Public menu — returns available items, optionally filtered by zoneId */
  @Get()
  async getMenu(@Query('zoneId') zoneId?: string): Promise<MenuResponse> {
    return this.menuService.getMenu(zoneId);
  }

  /** Public zone menu — returns only available items for a specific zone */
  @Get('items/zone/:zoneId')
  async getZoneItems(@Param('zoneId') zoneId: string): Promise<MenuItem[]> {
    return this.menuService.getItemsByZone(zoneId, true);
  }

  // ── Admin/Seller endpoints ──────────────────────────────────────────────────

  /**
   * GET /menu/admin — seller sees only their items; superadmin sees all.
   * Supports optional ?zoneId= filter.
   */
  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async getAllItems(
    @Request() req,
    @Query('zoneId') zoneId?: string,
  ): Promise<MenuItem[]> {
    const user = req.user;
    if (user.role === UserRole.SELLER) {
      return this.menuService.getSellerItems(user, zoneId);
    }
    // superadmin — return all items (optionally filtered by zone)
    if (zoneId) {
      return this.menuService.getItemsByZone(zoneId, false);
    }
    const menu = await this.menuService.getMenu();
    return [...menu.readyNow, ...menu.regular];
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async getItem(@Param('id') id: string, @Request() req): Promise<MenuItem> {
    const item = await this.menuService.getMenuItem(id);
    if (req.user.role === UserRole.SELLER) {
      await this.menuService.verifyItemOwnership(id, req.user.id);
    }
    return item;
  }

  /**
   * POST /menu/admin — seller and superadmin can create items.
   * Seller ownership of the zone is verified inside MenuService.
   */
  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async createItem(
    @Body() createItemDto: CreateMenuItemDto,
    @Request() req,
  ): Promise<MenuItem> {
    return this.menuService.createMenuItem(createItemDto, req.user);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async updateItem(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateMenuItemDto,
    @Request() req,
  ): Promise<MenuItem> {
    if (req.user.role === UserRole.SELLER) {
      await this.menuService.verifyItemOwnership(id, req.user.id);
    }
    return this.menuService.updateMenuItem(id, updateItemDto, req.user);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async deleteItem(@Param('id') id: string, @Request() req): Promise<void> {
    if (req.user.role === UserRole.SELLER) {
      await this.menuService.verifyItemOwnership(id, req.user.id);
    }
    return this.menuService.deleteMenuItem(id);
  }

  @Patch('admin/:id/ready-now')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async toggleReadyNow(
    @Param('id') id: string,
    @Body() toggleDto: ToggleReadyNowDto,
    @Request() req,
  ): Promise<MenuItem> {
    if (req.user.role === UserRole.SELLER) {
      await this.menuService.verifyItemOwnership(id, req.user.id);
    }
    return this.menuService.toggleReadyNow(id, toggleDto.readyNow);
  }

  @Post('admin/upload')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.filesService.uploadFile(file, 'menu');
    return { url: result.url };
  }

  // ── Category endpoints ──────────────────────────────────────────────────────

  @Get('categories')
  async getCategories(): Promise<MenuCategory[]> {
    return this.menuService.getCategories();
  }

  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<MenuCategory> {
    return this.menuService.createCategory(createCategoryDto);
  }

  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<MenuCategory> {
    return this.menuService.updateCategory(id, updateCategoryDto);
  }

  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SELLER, UserRole.SUPERADMIN)
  async deleteCategory(@Param('id') id: string): Promise<void> {
    return this.menuService.deleteCategory(id);
  }
}
