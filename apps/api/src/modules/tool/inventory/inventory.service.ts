/**
 * Tool Inventory Service
 * Manages the global tool inventory loaded from database
 * Replaces the hardcoded toolsetInventory from @refly/agent-tools
 * Uses Redis for caching with 10-minute expiration
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../common/prisma.service';
import { RedisService } from '../../common/redis.service';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { safeParseJSON } from '@refly/utils';
import { toolsetInventory as staticToolsetInventory } from '@refly/agent-tools';

export interface ToolsetInventoryItem {
  class: any; // Reserved for SDK-based toolsets
  definition: ToolsetDefinition;
}

interface CachedInventoryData {
  items: Array<{
    key: string;
    definition: ToolsetDefinition;
  }>;
  timestamp: string;
}

/**
 * Tool Inventory Service
 * Loads and caches toolset inventory from database
 * Uses Redis for caching with 10-minute expiration
 */
@Injectable()
export class ToolInventoryService implements OnModuleInit {
  private readonly logger = new Logger(ToolInventoryService.name);

  /**
   * Redis cache key for tool inventory
   */
  private readonly CACHE_KEY = 'tool:inventory:all';

  /**
   * Redis cache TTL: 10 minutes (600 seconds)
   */
  private readonly CACHE_TTL = 600;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Initialize on module startup
   */
  async onModuleInit(): Promise<void> {
    this.logger.log('Initializing Tool Inventory Service...');
    const inventory = await this.loadInventory();
    this.logger.log(`Tool Inventory initialized with ${inventory.size} toolsets`);
  }

  /**
   * Load inventory from Redis cache or database
   * @returns Inventory map (key -> ToolsetInventoryItem)
   */
  private async loadInventory(): Promise<Map<string, ToolsetInventoryItem>> {
    try {
      // Try to load from Redis cache first
      const cached = await this.loadFromCache();
      if (cached) {
        return cached;
      }
      const inventory = await this.loadFromDatabase();
      // Store in Redis cache
      await this.saveToCache(inventory);
      return inventory;
    } catch (error) {
      this.logger.error(
        `Failed to load inventory: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }

  /**
   * Load inventory from Redis cache
   * @returns Inventory map or null if cache miss
   */
  private async loadFromCache(): Promise<Map<string, ToolsetInventoryItem> | null> {
    try {
      const cached = await this.redis.get(this.CACHE_KEY);
      if (!cached) {
        return null;
      }
      const data: CachedInventoryData = JSON.parse(cached);
      const inventory = new Map<string, ToolsetInventoryItem>();
      for (const item of data.items) {
        inventory.set(item.key, {
          class: undefined,
          definition: item.definition,
        });
      }
      return inventory;
    } catch (error) {
      this.logger.warn(`Failed to load from cache: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Load inventory from database and merge with static inventory
   * @returns Inventory map
   */
  private async loadFromDatabase(): Promise<Map<string, ToolsetInventoryItem>> {
    const inventory = new Map<string, ToolsetInventoryItem>();

    // First, load static toolset inventory from @refly/agent-tools
    for (const [key, item] of Object.entries(staticToolsetInventory)) {
      inventory.set(key, {
        class: item.class,
        definition: item.definition,
      });
    }

    // Then, load from database and override static ones if they exist
    const inventoryItems = await this.prisma.toolsetInventory.findMany({
      where: {
        enabled: true,
        deletedAt: null,
      },
      orderBy: {
        key: 'asc',
      },
    });

    // Load all tool methods for enabled inventories
    const toolMethods = await this.prisma.toolMethod.findMany({
      where: {
        inventoryKey: { in: inventoryItems.map((item) => item.key) },
        enabled: true,
        deletedAt: null,
      },
      orderBy: {
        name: 'asc',
      },
    });

    // Group methods by inventory key
    const methodsByKey = new Map<string, typeof toolMethods>();
    for (const method of toolMethods) {
      const existing = methodsByKey.get(method.inventoryKey) || [];
      existing.push(method);
      methodsByKey.set(method.inventoryKey, existing);
    }

    for (const item of inventoryItems) {
      // Get methods for this inventory
      const methods = methodsByKey.get(item.key) || [];

      const definition: ToolsetDefinition = {
        key: item.key,
        domain: item.domain || undefined,
        labelDict: safeParseJSON(item.labelDict) || {},
        descriptionDict: safeParseJSON(item.descriptionDict) || {},
        tools: methods.map((method) => ({
          name: method.name,
          descriptionDict: { en: method.description, 'zh-CN': method.description },
        })),
        authPatterns: item.apiKey
          ? [
              {
                type: 'credentials',
                credentialItems: [
                  {
                    key: 'apiKey',
                    inputMode: 'text',
                    required: true,
                    labelDict: { en: 'API Key', 'zh-CN': 'API 密钥' },
                    descriptionDict: {
                      en: 'API Key for authentication',
                      'zh-CN': '用于认证的 API 密钥',
                    },
                  },
                ],
              },
            ]
          : undefined,
        configItems: item.configItems ? safeParseJSON(item.configItems) : undefined,
        requiresAuth: !!item.apiKey,
      };

      // Database entries can have a class (for SDK-based tools)
      // If the static inventory already has this key, preserve its class
      const existingClass = inventory.get(item.key)?.class;

      inventory.set(item.key, {
        class: existingClass || undefined,
        definition,
      });
    }

    this.logger.debug(
      `Loaded ${inventoryItems.length} toolsets from database, ${Object.keys(staticToolsetInventory).length} from static inventory, total: ${inventory.size}`,
    );

    return inventory;
  }

  /**
   * Save inventory to Redis cache
   * @param inventory - Inventory map to cache
   */
  private async saveToCache(inventory: Map<string, ToolsetInventoryItem>): Promise<void> {
    try {
      const data: CachedInventoryData = {
        items: Array.from(inventory.entries()).map(([key, item]) => ({
          key,
          definition: item.definition,
        })),
        timestamp: new Date().toISOString(),
      };

      await this.redis.setex(this.CACHE_KEY, this.CACHE_TTL, JSON.stringify(data));
      this.logger.debug(`Saved ${inventory.size} items to Redis cache with TTL ${this.CACHE_TTL}s`);
    } catch (error) {
      this.logger.warn(`Failed to save to cache: ${(error as Error).message}`);
    }
  }

  /**
   * Get the entire inventory map
   * Loads from Redis cache or database on each call
   * @returns Inventory map (key -> ToolsetInventoryItem)
   */
  async getInventoryMap(): Promise<Record<string, ToolsetInventoryItem>> {
    const inventory = await this.loadInventory();
    return Object.fromEntries(inventory);
  }

  /**
   * Get inventory item by key
   * Loads from Redis cache or database on each call
   * @param key - Toolset key
   * @returns ToolsetInventoryItem or undefined
   */
  async getInventoryItem(key: string): Promise<ToolsetInventoryItem | undefined> {
    const inventory = await this.loadInventory();
    return inventory.get(key);
  }

  /**
   * Get toolset definition by inventory key/name
   * Loads from Redis cache or database on each call
   * @param key - Toolset inventory key (name)
   * @returns ToolsetDefinition or undefined if not found
   */
  async getDefinitionByKey(key: string): Promise<ToolsetDefinition | undefined> {
    const inventoryItem = await this.getInventoryItem(key);
    return inventoryItem?.definition;
  }

  /**
   * Get toolset name by inventory key
   * Loads from database directly to get the name field
   * @param key - Toolset inventory key
   * @returns Toolset name or undefined if not found
   */
  async getNameByKey(key: string): Promise<string | undefined> {
    const toolset = await this.prisma.toolsetInventory.findUnique({
      where: {
        key,
        enabled: true,
        deletedAt: null,
      },
      select: {
        name: true,
      },
    });
    return toolset?.name;
  }

  /**
   * Get all inventory keys
   * Loads from Redis cache or database on each call
   * @returns Array of toolset keys
   */
  async getInventoryKeys(): Promise<string[]> {
    const inventory = await this.loadInventory();
    return Array.from(inventory.keys());
  }

  /**
   * Clear the Redis cache
   * Use this after updating tool methods or inventory items
   */
  async clearCache(): Promise<void> {
    try {
      await this.redis.del(this.CACHE_KEY);
      this.logger.log('Cleared tool inventory cache');
    } catch (error) {
      this.logger.error(`Failed to clear cache: ${(error as Error).message}`);
    }
  }

  /**
   * Get all inventory definitions
   * Loads from Redis cache or database on each call
   * @returns Array of ToolsetDefinition
   */
  async getInventoryDefinitions(): Promise<ToolsetDefinition[]> {
    const inventory = await this.loadInventory();
    return Array.from(inventory.values()).map((item) => item.definition);
  }

  /**
   * Check if a toolset exists in inventory
   * Loads from Redis cache or database on each call
   * @param key - Toolset key
   * @returns boolean
   */
  async hasInventoryItem(key: string): Promise<boolean> {
    const inventory = await this.loadInventory();
    return inventory.has(key);
  }

  /**
   * Get inventory size
   * Loads from Redis cache or database on each call
   * @returns Number of toolsets in inventory
   */
  async getInventorySize(): Promise<number> {
    const inventory = await this.loadInventory();
    return inventory.size;
  }

  /**
   * Invalidate cache and reload from database
   * Use this when inventory data changes
   */
  async refresh(): Promise<void> {
    this.logger.log('Manual inventory refresh triggered');
    try {
      await this.redis.del(this.CACHE_KEY);
      const inventory = await this.loadInventory();
      this.logger.log(`Inventory refreshed with ${inventory.size} toolsets`);
    } catch (error) {
      this.logger.error(
        `Failed to refresh inventory: ${(error as Error).message}`,
        (error as Error).stack,
      );
      throw error;
    }
  }
}
