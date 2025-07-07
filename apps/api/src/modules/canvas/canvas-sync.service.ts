import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import {
  SyncCanvasStateRequest,
  User,
  CanvasState,
  GetCanvasStateData,
  GetCanvasTransactionsData,
} from '@refly/openapi-schema';
import { initEmptyCanvasState, updateCanvasState } from '@refly/canvas-common';
import {
  CanvasNotFoundError,
  CanvasVersionNotFoundError,
  OperationTooFrequent,
} from '@refly/errors';
import { Canvas as CanvasModel } from '../../generated/client';
import { PrismaService } from '../common/prisma.service';
import { LockReleaseFn, RedisService } from '../common/redis.service';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { streamToBuffer, streamToString } from '../../utils';
import { genCanvasVersionId } from '@refly/utils';

@Injectable()
export class CanvasSyncService {
  private logger = new Logger(CanvasSyncService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    @Inject(OSS_INTERNAL) private oss: ObjectStorageService,
  ) {}

  /**
   * Get canvas YDoc from state storage key
   * @param stateStorageKey - The state storage key
   * @returns The canvas YDoc
   * @deprecated Yjs doc is not used anymore, use getState instead. This is only for backward compatibility.
   */
  async getCanvasYDoc(stateStorageKey: string) {
    if (!stateStorageKey) {
      return null;
    }

    try {
      const readable = await this.oss.getObject(stateStorageKey);
      if (!readable) {
        throw new Error('Canvas state not found');
      }

      const state = await streamToBuffer(readable);
      if (!state?.length) {
        throw new Error('Canvas state is empty');
      }

      const doc = new Y.Doc();
      Y.applyUpdate(doc, state);

      return doc;
    } catch (error) {
      this.logger.warn(`Error getting canvas YDoc for key ${stateStorageKey}: ${error?.message}`);
      return null;
    }
  }

  /**
   * Save canvas state (JSON) to object storage
   * @param canvasId - The canvas id
   * @param version - The canvas version
   * @param state - The canvas state
   */
  async saveState(canvasId: string, state: CanvasState) {
    state.version ||= genCanvasVersionId();
    const stateStorageKey = `canvas-state/${canvasId}/${state.version}`;
    await this.oss.putObject(stateStorageKey, JSON.stringify(state));
    return stateStorageKey;
  }

  /**
   * Get canvas state from object storage
   * @param canvasId - The canvas id
   * @returns The canvas state
   */
  async getState(
    user: User,
    param: GetCanvasStateData['query'],
    canvasPo?: CanvasModel,
  ): Promise<CanvasState> {
    const { canvasId, version } = param;
    const canvas =
      canvasPo ??
      (await this.prisma.canvas.findUnique({
        select: {
          version: true,
          stateStorageKey: true,
        },
        where: {
          canvasId,
          uid: user.uid,
          deletedAt: null,
        },
      }));

    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    if (!canvas.version) {
      if (!canvas.stateStorageKey) {
        return initEmptyCanvasState();
      }

      const doc = await this.getCanvasYDoc(canvas.stateStorageKey);
      if (!doc) {
        return initEmptyCanvasState();
      }

      const state = initEmptyCanvasState();
      state.nodes = doc?.getArray('nodes').toJSON() ?? [];
      state.edges = doc?.getArray('edges').toJSON() ?? [];

      const stateStorageKey = await this.saveState(canvasId, state);

      await this.prisma.$transaction([
        this.prisma.canvas.update({
          where: {
            canvasId,
          },
          data: {
            version: state.version,
          },
        }),
        this.prisma.canvasVersion.create({
          data: {
            canvasId,
            version: state.version,
            hash: '',
            stateStorageKey,
          },
        }),
      ]);

      return state;
    }

    const canvasVersion = await this.prisma.canvasVersion.findFirst({
      select: {
        stateStorageKey: true,
      },
      where: {
        canvasId,
        version: version ?? canvas.version, // use the latest version if not specified
      },
    });

    if (!canvasVersion) {
      throw new CanvasVersionNotFoundError();
    }

    const stream = await this.oss.getObject(canvasVersion.stateStorageKey);
    if (!stream) {
      throw new Error('Canvas state not found');
    }
    const stateStr = await streamToString(stream);

    return JSON.parse(stateStr);
  }

  /**
   * Get canvas transactions
   * @param user - The user
   * @param param - The get canvas transactions request
   * @returns The canvas transactions
   */
  async getTransactions(user: User, param: GetCanvasTransactionsData['query']) {
    const { canvasId, version, since } = param;
    const state = await this.getState(user, { canvasId, version });
    const transactions = state.transactions.filter((tx) => tx.createdAt > since);
    return transactions;
  }

  /**
   * Acquire a lock for the canvas state, with optional exponential backoff retry.
   * @param canvasId - The canvas id
   * @param options - The options
   * @param options.maxRetries - Maximum number of retries (default: 3)
   * @param options.initialDelay - Initial delay in ms for backoff (default: 100)
   * @returns A function to release the lock
   * @throws OperationTooFrequent if lock cannot be acquired after retries
   */
  async lockState(canvasId: string, options?: { maxRetries?: number; initialDelay?: number }) {
    const { maxRetries = 3, initialDelay = 100 } = options ?? {};
    const lockKey = `canvas-sync:${canvasId}`;
    let retries = 0;
    let delay = initialDelay;
    while (true) {
      const releaseLock = await this.redis.acquireLock(lockKey);
      if (releaseLock) {
        return releaseLock;
      }
      if (retries >= maxRetries) {
        throw new OperationTooFrequent('Failed to get lock for canvas');
      }
      // Exponential backoff before next retry
      await new Promise((resolve) => setTimeout(resolve, delay));
      delay *= 2;
      retries += 1;
    }
  }

  /**
   * Sync canvas state
   * @param user - The user
   * @param canvasId - The canvas id
   * @param param - The sync canvas state request
   */
  async syncState(
    user: User,
    param: SyncCanvasStateRequest,
    options?: { releaseLock?: LockReleaseFn },
  ) {
    const { canvasId, transactions, version } = param;

    const versionToSync =
      version ??
      (
        await this.prisma.canvas.findUnique({
          select: {
            version: true,
          },
          where: {
            canvasId,
            uid: user.uid,
            deletedAt: null,
          },
        })
      )?.version;

    if (!versionToSync) {
      throw new CanvasVersionNotFoundError();
    }

    if (!transactions?.length) {
      this.logger.warn(`[applyStateUpdate] no transactions to apply for canvas ${canvasId}`);
      return;
    }

    const releaseLock: LockReleaseFn = options?.releaseLock ?? (await this.lockState(canvasId));

    this.logger.log(
      `[syncState] sync state for canvas ${canvasId}, transactions: ${JSON.stringify(transactions)}`,
    );
    try {
      const state = await this.getState(user, { canvasId, version });
      updateCanvasState(state, transactions);
      await this.saveState(canvasId, state);
    } finally {
      await releaseLock();
    }
  }
}
