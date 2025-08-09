import { Injectable, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaginationService {
  private readonly DEFAULT_LIMIT = 25;
  private readonly MAX_LIMIT = 100;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cache: Cache
  ) {}

  async paginate<T>(
    model: string,
    params: {
      where?: any;
      include?: any;
      orderBy?: any;
      page?: number;
      limit?: number;
      cacheKeyPrefix?: string;
    }
  ): Promise<{
    data: T[];
    meta: {
      total: number;
      page: number;
      perPage: number;
      totalPages: number;
    };
  }>  {
    const { take, skip, page } = this.calculatePagination(params);
    const cacheKey = this.generateCacheKey(model, params, take, page);

    try {
      const cached = await this.getFromCache(cacheKey);
      if (cached) return this.formatPaginationResponse(cached, page, take);
    } catch (error) {
      console.error('Cache get error:', error);
    }

    const [data, total] = await Promise.all([
      this.prisma[model].findMany({
        where: params.where,
        include: params.include,
        orderBy: params.orderBy,
        take,
        skip,
      }),
      this.prisma[model].count({ where: params.where }),
    ]);

    try {
      await this.setCache(cacheKey, { data, total });
    } catch (error) {
      console.error('Cache set error:', error);
    }

    return this.formatPaginationResponse({ data, total }, page, take);
  }

  private calculatePagination(params: { page?: number; limit?: number }) {
    const take = Math.min(params.limit || this.DEFAULT_LIMIT, this.MAX_LIMIT);
    const page = params.page || 1;
    const skip = (page - 1) * take;
    return { take, skip, page };
  }

  private generateCacheKey(
    model: string,
    params: any,
    limit: number,
    page: number
  ): string {
    return [
      'paginate',
      model,
      JSON.stringify(params.where),
      params.orderBy ? JSON.stringify(params.orderBy) : '',
      `limit=${limit}`,
      `page=${page}`,
    ].join(':');
  }

  private async getFromCache(cacheKey: string) {
    return this.cache.get<{ data: any[]; total: number }>(cacheKey);
  }

  private async setCache(cacheKey: string, value: { data: any[]; total: number }) {
    await this.cache.set(cacheKey, value, this.CACHE_TTL);
  }

  private formatPaginationResponse(
    result: { data: any[]; total: number },
    page: number,
    take: number
  ) {
    return {
      data: result.data,
      meta: {
        total: result.total,
        page: page,
        perPage: take,
        totalPages: Math.ceil(result.total / take),
      }
    };
  }

  async clearCacheForModel(model: string): Promise<void> {
    const keys = await this.cache.store.keys?.(`paginate:${model}:*`) || [];
    await Promise.all(keys.map(key => this.cache.del(key)));
  }
}