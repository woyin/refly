import { Inject, Injectable, Logger } from '@nestjs/common';
import * as Y from 'yjs';
import { ApplyCanvasStateRequest, User, CanvasState } from '@refly/openapi-schema';
import { applyCanvasStateTransaction } from '@refly/canvas-common';
import { CanvasNotFoundError } from '@refly/errors';
import { Canvas as CanvasModel } from '../../generated/client';
import { PrismaService } from '../common/prisma.service';
import { ObjectStorageService, OSS_INTERNAL } from '../common/object-storage';
import { streamToBuffer, streamToString } from '../../utils';

@Injectable()
export class CanvasSyncService {
  private logger = new Logger(CanvasSyncService.name);

  constructor(
    private prisma: PrismaService,
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
   * @param state - The canvas state
   */
  async saveState(canvasId: string, state: CanvasState) {
    const dataStorageKey = `canvas-data/${canvasId}`;
    await this.oss.putObject(dataStorageKey, JSON.stringify(state));
  }

  /**
   * Get canvas state from object storage
   * @param canvasId - The canvas id
   * @returns The canvas state
   */
  async getState(user: User, canvasId: string, canvasPo?: CanvasModel): Promise<CanvasState> {
    const canvas =
      canvasPo ??
      (await this.prisma.canvas.findUnique({
        where: {
          canvasId,
          uid: user.uid,
          deletedAt: null,
        },
      }));

    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    if (!canvas.dataStorageKey) {
      if (!canvas.stateStorageKey) {
        return {
          title: canvas.title,
          nodes: [],
          edges: [],
        };
      }

      const doc = await this.getCanvasYDoc(canvas.stateStorageKey);
      if (!doc) {
        throw new Error('Canvas state not found');
      }

      const state = {
        title: canvas.title,
        nodes: doc?.getArray('nodes').toJSON() ?? [],
        edges: doc?.getArray('edges').toJSON() ?? [],
      };

      await this.saveState(canvasId, state);
      await this.prisma.canvas.update({
        where: {
          canvasId,
        },
        data: {
          dataStorageKey: `canvas-data/${canvasId}`,
        },
      });

      return state;
    }

    const stream = await this.oss.getObject(canvas.dataStorageKey);
    if (!stream) {
      throw new Error('Canvas state not found');
    }
    const stateStr = await streamToString(stream);

    return JSON.parse(stateStr);
  }

  /**
   * Apply canvas state update
   * @param user - The user
   * @param canvasId - The canvas id
   * @param param - The apply canvas state request
   */
  async applyStateUpdate(user: User, param: ApplyCanvasStateRequest) {
    const { canvasId, nodeDiffs = [], edgeDiffs = [] } = param;
    const canvas = await this.prisma.canvas.findUnique({
      where: {
        canvasId,
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (!canvas) {
      throw new CanvasNotFoundError();
    }

    // TODO: concurrency control, queue the updates

    const state = await this.getState(user, canvasId);
    const newState = applyCanvasStateTransaction(state, {
      nodeDiffs,
      edgeDiffs,
    });
    await this.saveState(canvasId, newState);
  }
}
