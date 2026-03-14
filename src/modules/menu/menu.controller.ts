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
import { AdminGuard } from '../auth/guards/admin.guard';
import { FilesService } from '../files/files.service';

@Controller('menu')
export class MenuController {
  constructor(
    private readonly menuService: MenuService,
    private readonly filesService: FilesService,
  ) {}

  @Get()
  async getMenu(@Query('zoneId') zoneId?: string): Promise<MenuResponse> {
    return this.menuService.getMenu(zoneId);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getAllItems(): Promise<MenuItem[]> {
    const menu = await this.menuService.getMenu();
    return [...menu.readyNow, ...menu.regular];
  }

  @Get('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getItem(@Param('id') id: string): Promise<MenuItem> {
    return this.menuService.getMenuItem(id);
  }

  @Post('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createItem(
    @Body() createItemDto: CreateMenuItemDto,
  ): Promise<MenuItem> {
    return this.menuService.createMenuItem(createItemDto);
  }

  @Patch('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateItem(
    @Param('id') id: string,
    @Body() updateItemDto: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    return this.menuService.updateMenuItem(id, updateItemDto);
  }

  @Delete('admin/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteItem(@Param('id') id: string): Promise<void> {
    return this.menuService.deleteMenuItem(id);
  }

  @Patch('admin/:id/ready-now')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggleReadyNow(
    @Param('id') id: string,
    @Body() toggleDto: ToggleReadyNowDto,
  ): Promise<MenuItem> {
    return this.menuService.toggleReadyNow(id, toggleDto.readyNow);
  }

  @Post('admin/upload')
  @UseGuards(JwtAuthGuard, AdminGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.filesService.uploadFile(file, 'menu');
    return { url: result.url };
  }

  // Category endpoints
  @Get('categories')
  async getCategories(): Promise<MenuCategory[]> {
    return this.menuService.getCategories();
  }

  @Post('admin/categories')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async createCategory(
    @Body() createCategoryDto: CreateCategoryDto,
  ): Promise<MenuCategory> {
    return this.menuService.createCategory(createCategoryDto);
  }

  @Patch('admin/categories/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateCategory(
    @Param('id') id: string,
    @Body() updateCategoryDto: UpdateCategoryDto,
  ): Promise<MenuCategory> {
    return this.menuService.updateCategory(id, updateCategoryDto);
  }

  @Delete('admin/categories/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async deleteCategory(@Param('id') id: string): Promise<void> {
    return this.menuService.deleteCategory(id);
  }
}
