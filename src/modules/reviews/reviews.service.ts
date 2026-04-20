import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Review } from './entities/review.entity';
import { CreateReviewDto } from './dto/create-review.dto';

@Injectable()
export class ReviewsService {
  constructor(
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  async create(userId: string, dto: CreateReviewDto): Promise<Review> {
    // Check if user already reviewed this item
    const existing = await this.reviewRepository.findOne({
      where: { userId, menuItemId: dto.menuItemId },
    });

    if (existing) {
      throw new BadRequestException('You have already reviewed this item');
    }

    const review = this.reviewRepository.create({
      ...dto,
      userId,
    });

    const saved = await this.reviewRepository.save(review);

    // Update menu item average rating
    await this.updateMenuItemRating(dto.menuItemId);

    return saved;
  }

  async getByMenuItem(menuItemId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { menuItemId },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async getByUser(userId: string): Promise<Review[]> {
    return this.reviewRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }

  async delete(id: string, userId: string): Promise<void> {
    const review = await this.reviewRepository.findOne({ where: { id } });

    if (!review) {
      throw new NotFoundException('Review not found');
    }

    if (review.userId !== userId) {
      throw new BadRequestException('You can only delete your own reviews');
    }

    const menuItemId = review.menuItemId;
    await this.reviewRepository.delete(id);

    // Update menu item average rating
    await this.updateMenuItemRating(menuItemId);
  }

  private async updateMenuItemRating(menuItemId: string): Promise<void> {
    const result = await this.reviewRepository
      .createQueryBuilder('review')
      .select('AVG(review.rating)', 'avg')
      .addSelect('COUNT(review.id)', 'count')
      .where('review.menuItemId = :menuItemId', { menuItemId })
      .getRawOne();

    const avgRating = result.avg ? parseFloat(result.avg).toFixed(2) : 0;
    const reviewCount = parseInt(result.count) || 0;

    // Update menu_items table
    await this.reviewRepository.query(
      `UPDATE menu_items SET average_rating = $1, review_count = $2 WHERE id = $3`,
      [avgRating, reviewCount, menuItemId],
    );
  }
}
