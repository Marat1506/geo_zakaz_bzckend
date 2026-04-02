import { Injectable, Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { MenuItem } from './entities/menu-item.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { ServiceZone } from '../geo/entities/service-zone.entity';
import { CreateMenuItemDto } from './dto/create-menu-item.dto';
import { UpdateMenuItemDto } from './dto/update-menu-item.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { User, UserRole } from '../auth/entities/user.entity';

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
    @InjectRepository(ServiceZone)
    private readonly serviceZoneRepository: Repository<ServiceZone>,
    @Inject(CACHE_MANAGER)
    private readonly cacheManager: Cache,
  ) { }

  async getMenu(zoneId?: string): Promise<MenuResponse> {
    // Get from database (removed caching due to compatibility issues)
    const query = this.menuItemRepository
      .createQueryBuilder('item')
      .where('item.available = :available', { available: true });

    if (zoneId) {
      query.andWhere('item.zoneId = :zoneId', { zoneId });
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

  /** Returns all available items for a specific zone (public endpoint) */
  async getItemsByZone(zoneId: string, onlyAvailable = true): Promise<MenuItem[]> {
    const query = this.menuItemRepository
      .createQueryBuilder('item')
      .where('item.zoneId = :zoneId', { zoneId });

    if (onlyAvailable) {
      query.andWhere('item.available = :available', { available: true });
    }

    return query.orderBy('item.name', 'ASC').getMany();
  }

  /** Returns all items from zones belonging to this seller */
  async getSellerItems(user: User, zoneId?: string): Promise<MenuItem[]> {
    // Get all zones owned by this seller
    const sellerZones = await this.serviceZoneRepository.find({
      where: { sellerId: user.id },
      select: ['id'],
    });

    if (sellerZones.length === 0) {
      return [];
    }

    const zoneIds = sellerZones.map((z) => z.id);

    const query = this.menuItemRepository
      .createQueryBuilder('item')
      .where('item.zoneId IN (:...zoneIds)', { zoneIds });

    if (zoneId) {
      // Extra filter: only items from the requested zone (must belong to seller)
      if (!zoneIds.includes(zoneId)) {
        return [];
      }
      query.andWhere('item.zoneId = :zoneId', { zoneId });
    }

    return query.orderBy('item.name', 'ASC').getMany();
  }

  async getMenuItem(id: string): Promise<MenuItem> {
    const item = await this.menuItemRepository.findOne({ where: { id } });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
    return item;
  }

  async createMenuItem(itemData: CreateMenuItemDto, user?: User): Promise<MenuItem> {
    // If user is provided, verify zone ownership
    if (user && itemData.zoneId) {
      const zone = await this.serviceZoneRepository.findOne({
        where: { id: itemData.zoneId },
      });
      if (!zone) {
        throw new NotFoundException('Zone not found');
      }
      // Seller can only create items in their own zones; superadmin can create in any zone
      if (user.role === UserRole.SELLER && zone.sellerId !== user.id) {
        throw new ForbiddenException('You can only add items to your own zones');
      }
    }

    // If category is provided, handle it
    if (itemData.category) {
      // Find or create category
      let category = await this.categoryRepository.findOne({
        where: { name: itemData.category },
      });
      if (!category) {
        category = this.categoryRepository.create({ name: itemData.category });
        await this.categoryRepository.save(category);
      }
    }

    const item = this.menuItemRepository.create(itemData);
    const savedItem = await this.menuItemRepository.save(item);
    return savedItem;
  }

  async updateMenuItem(
    id: string,
    itemData: UpdateMenuItemDto,
    user?: User,
  ): Promise<MenuItem> {
    const item = await this.getMenuItem(id);

    // If seller is updating, verify they aren't moving the item to a zone they don't own
    if (user && user.role === UserRole.SELLER && itemData.zoneId) {
      const zone = await this.serviceZoneRepository.findOne({
        where: { id: itemData.zoneId },
      });
      if (!zone || zone.sellerId !== user.id) {
        throw new ForbiddenException('You can only move items to your own zones');
      }
    }

    // If category is provided, handle it
    if (itemData.category) {
      // Find or create category
      let category = await this.categoryRepository.findOne({
        where: { name: itemData.category },
      });
      if (!category) {
        category = this.categoryRepository.create({ name: itemData.category });
        await this.categoryRepository.save(category);
      }
    }

    Object.assign(item, itemData);
    const updatedItem = await this.menuItemRepository.save(item);
    return updatedItem;
  }

  async verifyItemOwnership(itemId: string, sellerId: string): Promise<void> {
    const item = await this.menuItemRepository.findOne({
      where: { id: itemId },
      relations: ['zone'],
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    if (!item.zone || item.zone.sellerId !== sellerId) {
      throw new ForbiddenException('You do not have permission to manage this item');
    }
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
