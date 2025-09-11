import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../common/redis.service';
import { OperationTooFrequent } from '@refly/errors';
import { EntityType } from '@refly/openapi-schema';

@Injectable()
export class ShareRateLimitService {
  private readonly logger = new Logger(ShareRateLimitService.name);
  private readonly MAX_OPERATIONS_PER_HOUR = 5;
  private readonly WINDOW_SECONDS = 600; // 10 minute in seconds
  private readonly KEY_PREFIX = 'share_rate_limit:';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Generate a unique key for rate limiting based on user, entity type and entity ID
   */
  private generateKey(userId: string, entityType: EntityType, entityId: string): string {
    return `${this.KEY_PREFIX}${userId}:${entityType}:${entityId}`;
  }

  /**
   * Check if the operation is allowed based on the rate limit
   * @param userId - User identifier
   * @param entityType - Type of entity being shared
   * @param entityId - Entity identifier
   * @returns Promise<boolean> - true if operation is allowed, false if rate limited
   */
  async checkRateLimit(userId: string, entityType: EntityType, entityId: string): Promise<boolean> {
    const key = this.generateKey(userId, entityType, entityId);

    try {
      // Get current count
      const currentCountStr = await this.redisService.get(key);
      const currentCount = currentCountStr ? Number.parseInt(currentCountStr, 10) : 0;

      // Check if limit exceeded
      if (currentCount >= this.MAX_OPERATIONS_PER_HOUR) {
        this.logger.warn(
          `Rate limit exceeded for user ${userId}, entity ${entityType}:${entityId}. ` +
            `Current count: ${currentCount}/${this.MAX_OPERATIONS_PER_HOUR}`,
        );
        return false;
      }

      // Increment counter and set expiry if it's a new key
      const newCount = currentCount + 1;
      await this.redisService.setex(key, this.WINDOW_SECONDS, newCount.toString());

      this.logger.log(
        `Rate limit check passed for user ${userId}, entity ${entityType}:${entityId}. ` +
          `New count: ${newCount}/${this.MAX_OPERATIONS_PER_HOUR}`,
      );

      return true;
    } catch (error) {
      // In case of Redis error, allow the operation to avoid blocking legitimate users
      this.logger.error(`Rate limit check failed for user ${userId}: ${error.message}`);
      return true;
    }
  }

  /**
   * Check rate limit and throw error if exceeded
   * @param userId - User identifier
   * @param entityType - Type of entity being shared
   * @param entityId - Entity identifier
   * @throws OperationTooFrequent if rate limit is exceeded
   */
  async enforceRateLimit(userId: string, entityType: EntityType, entityId: string): Promise<void> {
    const isAllowed = await this.checkRateLimit(userId, entityType, entityId);

    if (!isAllowed) {
      throw new OperationTooFrequent(
        `Rate limit exceeded. You can only perform share operations on this entity ${this.MAX_OPERATIONS_PER_HOUR} times per hour.`,
      );
    }
  }

  /**
   * Get current rate limit status for an entity
   * @param userId - User identifier
   * @param entityType - Type of entity being shared
   * @param entityId - Entity identifier
   * @returns Object with current count and remaining operations
   */
  async getRateLimitStatus(
    userId: string,
    entityType: EntityType,
    entityId: string,
  ): Promise<{ currentCount: number; remaining: number; maxOperations: number }> {
    const key = this.generateKey(userId, entityType, entityId);

    try {
      const currentCountStr = await this.redisService.get(key);
      const currentCount = currentCountStr ? Number.parseInt(currentCountStr, 10) : 0;
      const remaining = Math.max(0, this.MAX_OPERATIONS_PER_HOUR - currentCount);

      return {
        currentCount,
        remaining,
        maxOperations: this.MAX_OPERATIONS_PER_HOUR,
      };
    } catch (error) {
      this.logger.error(`Failed to get rate limit status for user ${userId}: ${error.message}`);
      // Return default values in case of error
      return {
        currentCount: 0,
        remaining: this.MAX_OPERATIONS_PER_HOUR,
        maxOperations: this.MAX_OPERATIONS_PER_HOUR,
      };
    }
  }
}
