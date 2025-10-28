import { CopilotSession } from '@refly/openapi-schema';
import { CopilotSession as CopilotSessionPO } from '../../generated/client';
import { pick } from '../../utils';

/**
 * Convert CopilotSession PO to DTO
 */
export const copilotSessionPO2DTO = (session: CopilotSessionPO): CopilotSession => {
  return {
    ...pick(session, ['sessionId', 'title', 'canvasId']),
    createdAt: session.createdAt.toJSON(),
    updatedAt: session.updatedAt.toJSON(),
  };
};
