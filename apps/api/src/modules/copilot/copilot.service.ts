import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { User, ListCopilotSessionsData, GetCopilotSessionDetailData } from '@refly/openapi-schema';
import { CopilotSession } from '../../generated/client';

@Injectable()
export class CopilotService {
  private logger = new Logger(CopilotService.name);

  constructor(private prisma: PrismaService) {}

  async listCopilotSessions(
    user: User,
    params: ListCopilotSessionsData['query'],
  ): Promise<CopilotSession[]> {
    const { canvasId } = params;

    const sessions = await this.prisma.copilotSession.findMany({
      where: {
        uid: user.uid,
        ...(canvasId && { canvasId }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return sessions;
  }

  async getCopilotSessionDetail(
    user: User,
    params: GetCopilotSessionDetailData['query'],
  ): Promise<CopilotSession | null> {
    const { sessionId } = params;

    const session = await this.prisma.copilotSession.findFirst({
      where: {
        sessionId,
        uid: user.uid,
      },
    });

    return session;
  }
}
