import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

export interface MenuResponse {
  readyNow: MenuItem[];
  regular: MenuItem[];
}

@Injectable()
export class MenuService {
  private readonly CACHE_TTL = 300; // 5 minutes

  constructor(
    @InjectRepository(MenuItem)
    private readonly menuItemRepository: Repository<MenuItem>,
    @InjectRepository(MenuCategory)
    private readonly categoryRepository: Repository<MenuCategory>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) {}

  async getMenu(zoneId?: string): Promise<MenuResponse> {
    // Get from database (removed caching due to compatibility issues)
    const query = this.menuItemRepository
      .createQueryBuilder('item')
      .where('item.available = :available', { available: true });

    if (zoneId) {
      query.andWhere('(item.zoneId = :zoneId OR item.zoneId IS NULL)', {
        zoneId,
      });
    }

    const items = await query.getMany();

    // Separate into readyNow and regular
    const readyNow: MenuItem[] = [];
    const regular: MenuItem[] = [];

    for (const item of items) {
      if (item.readyNow) {
        readyNow.push(item);
      } else {
        regular.push(item);
      }
    }

    // Sort by name
    readyNow.sort((a, b) => a.name.localeCompare(b.name));
    regular.sort((a, b) => a.name.localeCompare(b.name));

    return { readyNow, regular };
  }

  async getMenuItem(id: string): Promise<MenuItem> {
    const item = await this.menuItemRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
    return item;
  }

  async createMenuItem(itemData: CreateMenuItemDto): Promise<MenuItem> {
    const item = this.menuItemRepository.create(itemData);
    const savedItem = await this.menuItemRepository.save(item);
    return savedItem;
  }

  async updateMenuItem(
    id: string,
    itemData: UpdateMenuItemDto,
  ): Promise<MenuItem> {
    const item = await this.getMenuItem(id);
    Object.assign(item, itemData);
    const updatedItem = await this.menuItemRepository.save(item);
    return updatedItem;
  }

  async deleteMenuItem(id: string): Promise<void> {
    await this.menuItemRepository.delete(id);
  }

  async toggleReadyNow(id: string, readyNow: boolean): Promise<MenuItem> {
    const item = await this.getMenuItem(id);
    item.readyNow = readyNow;
    const updatedItem = await this.menuItemRepository.save(item);
    return updatedItem;
  }

  // Category methods
  async getCategories(): Promise<MenuCategory[]> {
    return this.categoryRepository.find({ order: { order: 'ASC', name: 'ASC' } });
  }

  async createCategory(categoryData: CreateCategoryDto): Promise<MenuCategory> {
    const category = this.categoryRepository.create(categoryData);
    return this.categoryRepository.save(category);
  }

  async updateCategory(
    id: string,
    categoryData: UpdateCategoryDto,
  ): Promise<MenuCategory> {
    const category = await this.categoryRepository.findOne({ where: { id } });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    Object.assign(category, categoryData);
    return this.categoryRepository.save(category);
  }

  async deleteCategory(id: string): Promise<void> {
    await this.categoryRepository.delete(id);
  }
}
