/**
 * Configuration loader implementation
 * Loads tool configurations from database structure (Toolset + ToolMethod)
 */

import { Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../../common/prisma.service';
import { RedisService } from '../../../common/redis.service';
import type { ToolsetConfig } from '@refly/openapi-schema';
import type { IConfigLoader } from '../interfaces';

type MethodRecord = {
  pk: number | bigint;
  name: string;
  description: string;
  endpoint: string;
  httpMethod: string;
  requestSchema: string;
  responseSchema: string;
  adapterType: string | null;
};

type FingerprintPayload = {
  toolset: string;
  methods: Record<string, string>;
};

/**
 * Configuration loader service
 * Loads toolset configurations from database
 * Version management is controlled by versionId in ToolMethod records
 * Uses MD5 hash comparison to detect configuration changes
 */
@Injectable()
export class ConfigLoader implements IConfigLoader {
  private readonly logger = new Logger(ConfigLoader.name);
  private readonly configCache = new Map<string, { config: ToolsetConfig; timestamp: number }>();
  private readonly CACHE_TTL = 10 * 60 * 1000; // 10 minutes
  private readonly REDIS_MD5_KEY_PREFIX = 'tool:config:md5:';
  private readonly REDIS_MD5_TTL = 24 * 60 * 60; // 24 hours
  private isInitializing = true;

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Mark initialization as complete (should be called after service startup)
   */
  setInitializationComplete(): void {
    this.isInitializing = false;
    this.logger.log('Configuration loader initialization complete');
  }

  /**
   * Calculate MD5 hash of configuration data
   */
  private calculateToolsetMD5(toolset: {
    toolsetId: string;
    domain: string | null;
    name: string;
    key: string;
  }): string {
    const payload = JSON.stringify({
      toolsetId: toolset.toolsetId,
      domain: toolset.domain,
      name: toolset.name,
      key: toolset.key,
    });
    return createHash('md5').update(payload).digest('hex');
  }

  private calculateMethodMD5(method: MethodRecord): string {
    const payload = JSON.stringify({
      pk: method.pk.toString(),
      name: method.name,
      description: method.description,
      endpoint: method.endpoint,
      httpMethod: method.httpMethod,
      requestSchema: method.requestSchema,
      responseSchema: method.responseSchema,
      adapterType: method.adapterType,
    });
    return createHash('md5').update(payload).digest('hex');
  }

  /**
   * Get Redis key for storing config MD5
   */
  private getConfigMD5Key(toolsetKey: string): string {
    return `${this.REDIS_MD5_KEY_PREFIX}${toolsetKey}`;
  }

  /**
   * Load configuration by inventory key
   * Loads from ToolsetInventory and associated ToolMethods
   * Uses MD5 comparison to detect changes - only loads if config changed or during initialization
   * @param inventoryKey - Toolset inventory key (e.g., 'fish_audio', 'heygen')
   */
  async loadConfig(inventoryKey: string): Promise<ToolsetConfig | null> {
    try {
      const cacheKey = inventoryKey;

      // Check cache first
      const cached = this.configCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.config;
      }

      // Load from ToolsetInventory
      const inventory = await this.prisma.toolsetInventory.findFirst({
        where: {
          key: inventoryKey,
          enabled: true,
          deletedAt: null,
        },
        include: {
          methods: {
            where: {
              enabled: true,
              deletedAt: null,
            },
            orderBy: {
              createdAt: 'desc',
            },
          },
        },
      });

      if (!inventory) {
        this.logger.warn(`No inventory found for key: ${inventoryKey}`);
        return null;
      }

      // Filter to keep only the latest version of each method (by name)
      const methodMap = new Map<string, (typeof inventory.methods)[0]>();
      for (const method of inventory.methods) {
        if (!methodMap.has(method.name)) {
          methodMap.set(method.name, method);
        }
      }
      const methods = Array.from(methodMap.values()).sort((a, b) => a.name.localeCompare(b.name));

      if (methods.length === 0) {
        this.logger.warn(`No methods found for inventory key: ${inventoryKey}`);
        return null;
      }

      const inventoryHash = this.calculateToolsetMD5({
        toolsetId: cacheKey,
        domain: inventory.domain,
        name: inventory.key,
        key: inventory.key,
      });

      const methodHashes = methods.reduce<Record<string, string>>((acc, method) => {
        acc[method.name] = this.calculateMethodMD5(method);
        return acc;
      }, {});

      const storedPayloadRaw = await this.redis.get(this.getConfigMD5Key(cacheKey));
      let storedPayload: FingerprintPayload | null = null;
      if (storedPayloadRaw) {
        try {
          storedPayload = JSON.parse(storedPayloadRaw) as FingerprintPayload;
        } catch (parseError) {
          this.logger.warn(
            `Failed to parse fingerprint payload for ${cacheKey}, treating as changed: ${(parseError as Error).message}`,
          );
        }
      }

      const additions: string[] = [];
      const updates: string[] = [];
      const deletions: string[] = [];

      for (const [name, hash] of Object.entries(methodHashes)) {
        const storedHash = storedPayload?.methods?.[name];
        if (!storedHash) {
          additions.push(name);
        } else if (storedHash !== hash) {
          updates.push(name);
        }
      }

      if (storedPayload?.methods) {
        for (const name of Object.keys(storedPayload.methods)) {
          if (!(name in methodHashes)) {
            deletions.push(name);
          }
        }
      }

      const inventoryChanged = storedPayload?.toolset !== inventoryHash;
      const configChanged =
        inventoryChanged || additions.length > 0 || updates.length > 0 || deletions.length > 0;
      const shouldLoad = this.isInitializing || configChanged;

      if (!shouldLoad) {
        this.logger.debug(`Config unchanged for ${cacheKey}, skipping reload`);
        // Return cached config if available
        if (cached) {
          return cached.config;
        }
      }

      if (configChanged) {
        this.logger.log(
          `Config changed for ${cacheKey} (inventoryChanged=${inventoryChanged}, additions=${additions.length}, updates=${updates.length}, deletions=${deletions.length})`,
        );
      } else if (this.isInitializing) {
        this.logger.log(`Loading config during initialization for ${cacheKey}`);
      }

      // Load API key from inventory
      const apiKey = inventory.apiKey || '';
      // Build ToolsetConfig from inventory and methods
      const config: ToolsetConfig = {
        inventoryKey,
        domain: inventory.domain,
        name: inventory.name,
        credentials: apiKey ? { apiKey } : undefined,
        methods: methods.map((method) => ({
          name: method.name,
          version: Number(method.versionId), // Use pk as incremental version number
          description: method.description,
          endpoint: method.endpoint,
          method: method.httpMethod as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
          schema: method.requestSchema,
          responseSchema: method.responseSchema,
          useSdk: method.adapterType === 'sdk',
          timeout: 30000, // Default timeout
        })),
      };

      const fingerprintPayload: FingerprintPayload = {
        toolset: inventoryHash,
        methods: methodHashes,
      };

      await this.redis.setex(
        this.getConfigMD5Key(cacheKey),
        this.REDIS_MD5_TTL,
        JSON.stringify(fingerprintPayload),
      );

      // Cache the config
      this.configCache.set(cacheKey, {
        config,
        timestamp: Date.now(),
      });

      this.logger.log(`Loaded config for ${cacheKey}, methods: ${methods.length}`);
      return config;
    } catch (error) {
      this.logger.error(
        `Failed to load config for ${inventoryKey}: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return null;
    }
  }

  /**
   * Load all active toolset configurations from inventory
   * @param type - Optional filter by authType (e.g., 'config_based')
   */
  async loadAllConfigs(type: string): Promise<ToolsetConfig[]> {
    try {
      // Load all enabled inventory items
      const inventoryItems = await this.prisma.toolsetInventory.findMany({
        where: {
          enabled: true,
          deletedAt: null,
          type: type || undefined,
        },
      });

      const configs: ToolsetConfig[] = [];

      for (const inventory of inventoryItems) {
        try {
          const config = await this.loadConfig(inventory.key);
          if (config) {
            configs.push(config);
          }
        } catch (error) {
          this.logger.error(
            `Failed to load config for ${inventory.key}: ${(error as Error).message}`,
          );
        }
      }

      this.logger.log(
        `Loaded ${configs.length} toolset configurations from inventory${type ? ` with type=${type}` : ''}`,
      );
      return configs;
    } catch (error) {
      this.logger.error(
        `Failed to load all configs: ${(error as Error).message}`,
        (error as Error).stack,
      );
      return [];
    }
  }

  /**
   * Reload configuration (clear cache and load fresh)
   * @param inventoryKey - Toolset inventory key
   */
  async reloadConfig(inventoryKey: string): Promise<ToolsetConfig | null> {
    const cacheKey = inventoryKey;
    this.logger.log(`Reloading config for ${cacheKey}`);
    this.configCache.delete(cacheKey);
    return this.loadConfig(inventoryKey);
  }

  /**
   * Clear all cached configurations
   */
  clearCache(): void {
    this.logger.log('Clearing configuration cache');
    this.configCache.clear();
  }
}
