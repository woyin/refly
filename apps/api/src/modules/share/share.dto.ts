import { ShareRecord as ShareRecordModel } from '../../generated/client';
import { CreateShareRequest, EntityType, ShareRecord, User } from '@refly/openapi-schema';
import { pick } from '@refly/utils';

export function shareRecordPO2DTO(shareRecord: ShareRecordModel): ShareRecord {
  return {
    ...pick(shareRecord, [
      'shareId',
      'entityId',
      'allowDuplication',
      'parentShareId',
      'templateId',
    ]),
    entityType: shareRecord.entityType as EntityType,
    createdAt: shareRecord.createdAt.toJSON(),
    updatedAt: shareRecord.updatedAt.toJSON(),
  };
}

export interface CreateShareJobData {
  user: Pick<User, 'uid'>;
  req: CreateShareRequest;
}

export interface ShareExtraData {
  vectorStorageKey: string;
}
