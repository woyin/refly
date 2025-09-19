import { Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  Resource as ResourceModel,
  Document as DocumentModel,
} from '../../generated/client';
import { PrismaService } from '../common/prisma.service';
import {
  User,
  QueryReferencesRequest,
  ReferenceType,
  BaseReference,
  AddReferencesRequest,
  DeleteReferencesRequest,
  ReferenceMeta,
} from '@refly/openapi-schema';
import { genReferenceID } from '@refly/utils';
import { ExtendedReferenceModel } from './knowledge.dto';
import { MiscService } from '../misc/misc.service';
import { ParamsError, ReferenceNotFoundError, ReferenceObjectMissingError } from '@refly/errors';

@Injectable()
export class KnowledgeService {
  private logger = new Logger(KnowledgeService.name);

  constructor(
    private prisma: PrismaService,
    private miscService: MiscService,
  ) {}

  async queryReferences(
    user: User,
    param: QueryReferencesRequest,
  ): Promise<ExtendedReferenceModel[]> {
    const { sourceType, sourceId, targetType, targetId } = param;

    // Check if the source and target entities exist for this user
    const entityChecks: Promise<void>[] = [];
    if (sourceType && sourceId) {
      entityChecks.push(this.miscService.checkEntity(user, sourceId, sourceType));
    }
    if (targetType && targetId) {
      entityChecks.push(this.miscService.checkEntity(user, targetId, targetType));
    }
    await Promise.all(entityChecks);

    const where: Prisma.ReferenceWhereInput = {};
    if (sourceType && sourceId) {
      where.sourceType = sourceType;
      where.sourceId = sourceId;
    }
    if (targetType && targetId) {
      where.targetType = targetType;
      where.targetId = targetId;
    }
    if (Object.keys(where).length === 0) {
      throw new ParamsError('Either source or target condition is required');
    }

    const references = await this.prisma.reference.findMany({ where });

    // Collect all document IDs and resource IDs from both source and target
    const docIds = new Set<string>();
    const resourceIds = new Set<string>();
    for (const ref of references) {
      if (ref.sourceType === 'document') docIds.add(ref.sourceId);
      if (ref.targetType === 'document') docIds.add(ref.targetId);
      if (ref.sourceType === 'resource') resourceIds.add(ref.sourceId);
      if (ref.targetType === 'resource') resourceIds.add(ref.targetId);
    }

    // Fetch document mappings if there are any documents
    const docsMap: Record<string, DocumentModel> = {};
    if (docIds.size > 0) {
      const docs = await this.prisma.document.findMany({
        where: { docId: { in: Array.from(docIds) }, deletedAt: null },
      });
      for (const doc of docs) {
        docsMap[doc.docId] = doc;
      }
    }

    // Fetch resource mappings if there are any resources
    const resourceMap: Record<string, ResourceModel> = {};
    if (resourceIds.size > 0) {
      const resources = await this.prisma.resource.findMany({
        where: { resourceId: { in: Array.from(resourceIds) }, deletedAt: null },
      });
      for (const resource of resources) {
        resourceMap[resource.resourceId] = resource;
      }
    }

    const genReferenceMeta = (sourceType: string, sourceId: string) => {
      let refMeta: ReferenceMeta;
      if (sourceType === 'resource') {
        refMeta = {
          title: resourceMap[sourceId]?.title,
          url: JSON.parse(resourceMap[sourceId]?.meta || '{}')?.url,
        };
      } else if (sourceType === 'document') {
        refMeta = {
          title: docsMap[sourceId]?.title,
        };
      }
      return refMeta;
    };

    // Attach metadata to references
    return references.map((ref) => {
      return {
        ...ref,
        sourceMeta: genReferenceMeta(ref.sourceType, ref.sourceId),
        targetMeta: genReferenceMeta(ref.targetType, ref.targetId),
      };
    });
  }

  private async prepareReferenceInputs(
    user: User,
    references: BaseReference[],
  ): Promise<Prisma.ReferenceCreateManyInput[]> {
    const validRefTypes: ReferenceType[] = ['resource', 'document'];

    // Deduplicate references using a Set with stringified unique properties
    const uniqueRefs = new Set(
      references.map((ref) =>
        JSON.stringify({
          sourceType: ref.sourceType,
          sourceId: ref.sourceId,
          targetType: ref.targetType,
          targetId: ref.targetId,
        }),
      ),
    );
    const deduplicatedRefs: BaseReference[] = Array.from(uniqueRefs).map((ref) => JSON.parse(ref));

    const resourceIds: Set<string> = new Set();
    const docIds: Set<string> = new Set();

    for (const ref of deduplicatedRefs) {
      if (!validRefTypes.includes(ref.sourceType)) {
        throw new ParamsError(`Invalid source type: ${ref.sourceType}`);
      }
      if (!validRefTypes.includes(ref.targetType)) {
        throw new ParamsError(`Invalid target type: ${ref.targetType}`);
      }
      if (ref.sourceType === 'resource' && ref.targetType === 'document') {
        throw new ParamsError('Resource to document reference is not allowed');
      }
      if (ref.sourceType === ref.targetType && ref.sourceId === ref.targetId) {
        throw new ParamsError('Source and target cannot be the same');
      }

      if (ref.sourceType === 'resource') {
        resourceIds.add(ref.sourceId);
      } else if (ref.sourceType === 'document') {
        docIds.add(ref.sourceId);
      }

      if (ref.targetType === 'resource') {
        resourceIds.add(ref.targetId);
      } else if (ref.targetType === 'document') {
        docIds.add(ref.targetId);
      }
    }

    const [resources, docs] = await Promise.all([
      this.prisma.resource.findMany({
        select: { resourceId: true },
        where: {
          resourceId: { in: Array.from(resourceIds) },
          uid: user.uid,
          deletedAt: null,
        },
      }),
      this.prisma.document.findMany({
        select: { docId: true },
        where: {
          docId: { in: Array.from(docIds) },
          uid: user.uid,
          deletedAt: null,
        },
      }),
    ]);

    // Check if all the entities exist
    const foundIds = new Set([...resources.map((r) => r.resourceId), ...docs.map((c) => c.docId)]);
    const missingEntities = deduplicatedRefs.filter(
      (e) => !foundIds.has(e.sourceId) || !foundIds.has(e.targetId),
    );
    if (missingEntities.length > 0) {
      this.logger.warn(`Entities not found: ${JSON.stringify(missingEntities)}`);
      throw new ReferenceObjectMissingError();
    }

    return deduplicatedRefs.map((ref) => ({
      ...ref,
      referenceId: genReferenceID(),
      uid: user.uid,
    }));
  }

  async addReferences(user: User, param: AddReferencesRequest) {
    const { references } = param;
    const referenceInputs = await this.prepareReferenceInputs(user, references);

    return this.prisma.$transaction(
      referenceInputs.map((input) =>
        this.prisma.reference.upsert({
          where: {
            sourceType_sourceId_targetType_targetId: {
              sourceType: input.sourceType,
              sourceId: input.sourceId,
              targetType: input.targetType,
              targetId: input.targetId,
            },
          },
          create: input,
          update: { deletedAt: null },
        }),
      ),
    );
  }

  async deleteReferences(user: User, param: DeleteReferencesRequest) {
    const { referenceIds } = param;

    const references = await this.prisma.reference.findMany({
      where: {
        referenceId: { in: referenceIds },
        uid: user.uid,
        deletedAt: null,
      },
    });

    if (references.length !== referenceIds.length) {
      throw new ReferenceNotFoundError('Some of the references cannot be found');
    }

    await this.prisma.reference.updateMany({
      data: { deletedAt: new Date() },
      where: {
        referenceId: { in: referenceIds },
        uid: user.uid,
        deletedAt: null,
      },
    });
  }
}
