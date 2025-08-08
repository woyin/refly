import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../common/prisma.service';

describe('Divergent Database Integration', () => {
  let prisma: PrismaService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('PilotSession divergent fields', () => {
    it('should create PilotSession with divergent mode fields', async () => {
      const sessionData = {
        sessionId: `test-divergent-${Date.now()}`,
        uid: 'test-user',
        title: 'Test Divergent Session',
        input: JSON.stringify({ query: 'Test divergent query' }),
        targetType: 'canvas',
        targetId: 'test-canvas',
        // Divergent specific fields
        mode: 'divergent' as const,
        maxDivergence: 8,
        maxDepth: 5,
        currentDepth: 0,
      };

      const session = await prisma.pilotSession.create({
        data: sessionData,
      });

      expect(session.mode).toBe('divergent');
      expect(session.maxDivergence).toBe(8);
      expect(session.maxDepth).toBe(5);
      expect(session.currentDepth).toBe(0);

      // Cleanup
      await prisma.pilotSession.delete({
        where: { sessionId: session.sessionId },
      });
    });
  });

  describe('PilotStep divergent fields', () => {
    let testSessionId: string;

    beforeEach(async () => {
      // Create a test session first
      const session = await prisma.pilotSession.create({
        data: {
          sessionId: `test-session-${Date.now()}`,
          uid: 'test-user',
          title: 'Test Session for Steps',
          input: JSON.stringify({ query: 'Test query' }),
          mode: 'divergent',
          maxDivergence: 8,
          maxDepth: 5,
          currentDepth: 0,
        },
      });
      testSessionId = session.sessionId;
    });

    afterEach(async () => {
      // Cleanup steps and session
      await prisma.pilotStep.deleteMany({
        where: { sessionId: testSessionId },
      });
      await prisma.pilotSession.delete({
        where: { sessionId: testSessionId },
      });
    });

    it('should create PilotStep with summary node fields', async () => {
      const stepData = {
        stepId: `test-step-${Date.now()}`,
        sessionId: testSessionId,
        name: 'summary_step',
        epoch: 0,
        // Divergent specific fields
        nodeType: 'summary' as const,
        depth: 0,
        convergenceGroup: 'group-1',
        completionScore: 0.85,
      };

      const step = await prisma.pilotStep.create({
        data: stepData,
      });

      expect(step.nodeType).toBe('summary');
      expect(step.depth).toBe(0);
      expect(step.convergenceGroup).toBe('group-1');
      expect(Number(step.completionScore)).toBe(0.85);
    });

    it('should create PilotStep with execution node and parent relationship', async () => {
      // Create parent step first
      const parentStep = await prisma.pilotStep.create({
        data: {
          stepId: `parent-${Date.now()}`,
          sessionId: testSessionId,
          name: 'parent_summary',
          epoch: 0,
          nodeType: 'summary',
          depth: 0,
        },
      });

      // Create child execution step
      const childStepData = {
        stepId: `child-${Date.now()}`,
        sessionId: testSessionId,
        name: 'execution_step',
        epoch: 0,
        nodeType: 'execution' as const,
        depth: 1,
        parentStepId: parentStep.stepId,
        convergenceGroup: 'group-1',
      };

      const childStep = await prisma.pilotStep.create({
        data: childStepData,
      });

      expect(childStep.nodeType).toBe('execution');
      expect(childStep.depth).toBe(1);
      expect(childStep.parentStepId).toBe(parentStep.stepId);
      expect(childStep.convergenceGroup).toBe('group-1');
    });
  });
});
