import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { DeleteShareRequest, ListSharesData, User, EntityType } from '@refly/openapi-schema';
import { ShareNotFoundError } from '@refly/errors';
import { RAGService } from '../rag/rag.service';
import { ShareRateLimitService } from './share-rate-limit.service';
import { safeParseJSON } from '@refly/utils';

@Injectable()
export class ShareCommonService {
  private logger = new Logger(ShareCommonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ragService: RAGService,
    private readonly miscService: MiscService,
    private readonly shareRateLimitService: ShareRateLimitService,
  ) {}

  async storeVector(
    user: User,
    param: {
      shareId: string;
      entityId: string;
      entityType: 'document' | 'resource';
      vectorStorageKey: string;
    },
  ) {
    const { shareId, entityId, entityType, vectorStorageKey } = param;
    const vector = await this.ragService.serializeToAvro(user, {
      nodeType: entityType,
      ...(entityType === 'document' && {
        docId: entityId,
      }),
      ...(entityType === 'resource' && {
        resourceId: entityId,
      }),
    });
    await this.miscService.uploadBuffer(user, {
      fpath: 'vector.avro',
      buf: vector.data,
      entityId: shareId,
      entityType: 'share',
      visibility: 'public',
      storageKey: vectorStorageKey,
    });
  }

  async restoreVector(
    user: User,
    param: {
      entityId: string;
      entityType: 'document' | 'resource';
      vectorStorageKey: string;
    },
  ) {
    const { entityId, entityType, vectorStorageKey } = param;
    const vector = await this.miscService.downloadFile({
      storageKey: vectorStorageKey,
      visibility: 'public',
    });
    await this.ragService.deserializeFromAvro(user, {
      data: vector,
      ...(entityType === 'document' && {
        targetDocId: entityId,
      }),
      ...(entityType === 'resource' && {
        targetResourceId: entityId,
      }),
    });
  }

  async listShares(user: User, param: ListSharesData['query']) {
    const { shareId, entityId, entityType } = param;

    const shares = await this.prisma.shareRecord.findMany({
      where: { shareId, entityId, entityType, uid: user.uid, deletedAt: null },
    });

    return shares;
  }

  async deleteShare(user: User, body: DeleteShareRequest) {
    const { shareId } = body;

    const mainRecord = await this.prisma.shareRecord.findFirst({
      where: { shareId, uid: user.uid, deletedAt: null },
    });

    if (!mainRecord) {
      throw new ShareNotFoundError();
    }

    // Check rate limit before processing share deletion
    await this.shareRateLimitService.enforceRateLimit(
      user.uid,
      mainRecord.entityType as EntityType,
      mainRecord.entityId,
    );

    const childRecords = await this.prisma.shareRecord.findMany({
      where: { parentShareId: shareId, uid: user.uid, deletedAt: null },
    });
    const allRecords = [mainRecord, ...childRecords];

    await this.prisma.shareRecord.updateMany({
      data: { deletedAt: new Date() },
      where: { pk: { in: allRecords.map((r) => r.pk) } },
    });

    await this.miscService.batchRemoveObjects(
      user,
      allRecords.map((r) => ({
        storageKey: r.storageKey,
        visibility: 'public',
      })),
      { force: true }, // share static files must be deleted
    );
  }

  /**
   * Common method to get shared data
   * @param storageKey object storage key
   * @returns shared data object
   */
  async getSharedData(storageKey: string): Promise<any> {
    try {
      const contentBuffer = await this.miscService.downloadFile({
        storageKey,
        visibility: 'public',
      });

      return safeParseJSON(contentBuffer.toString());
    } catch (error) {
      this.logger.error(`Error reading shared content from ${storageKey}, ${error.stack}`);
      throw new ShareNotFoundError();
    }
  }

  /**
   * Update file references in canvas nodes
   * Replaces old fileIds with new fileIds in node metadata (e.g., contextItems)
   */
  updateFileReferencesInNodes(nodes: any[], fileIdMap: Map<string, string>): void {
    if (!nodes || nodes.length === 0 || fileIdMap.size === 0) {
      return;
    }

    for (const node of nodes) {
      // Check skillResponse nodes for contextItems
      if (node.type === 'skillResponse' && node.data?.metadata?.contextItems) {
        const contextItems = node.data.metadata.contextItems;
        for (const item of contextItems) {
          if (item.type === 'file' && item.entityId) {
            const newFileId = fileIdMap.get(item.entityId);
            if (newFileId) {
              item.entityId = newFileId;
              this.logger.debug(
                `Updated file reference in node ${node.id}: ${item.entityId} -> ${newFileId}`,
              );
            }
          }
        }
      }

      // Check for query string that might contain file references
      if (node.data?.metadata?.query && typeof node.data.metadata.query === 'string') {
        let query = node.data.metadata.query;
        let updated = false;

        // Replace file references in query string (format: @{type=file,id=df-xxx,...})
        for (const [oldId, newId] of fileIdMap.entries()) {
          const oldPattern = new RegExp(`id=${oldId}`, 'g');
          if (oldPattern.test(query)) {
            query = query.replace(oldPattern, `id=${newId}`);
            updated = true;
          }
        }

        if (updated) {
          node.data.metadata.query = query;
          this.logger.debug(`Updated file references in query for node ${node.id}`);
        }
      }
    }
  }
}
