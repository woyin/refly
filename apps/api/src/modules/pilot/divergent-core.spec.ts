import {
  DivergentSession,
  DivergentStep,
  ConvergenceResult,
  NextActionDecision,
} from './types/divergent.types';

describe('DivergentCore Data Structures', () => {
  describe('DivergentSession', () => {
    it('should define DivergentSession with required divergent fields', () => {
      const session: DivergentSession = {
        sessionId: 'test-session-123',
        title: 'Test Divergent Session',
        input: { query: 'Test user query' },
        status: 'executing',
        targetType: 'canvas',
        targetId: 'canvas-123',
        currentEpoch: 0,
        maxEpoch: 3,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        // Divergent specific fields
        mode: 'divergent',
        maxDivergence: 8,
        maxDepth: 5,
        currentDepth: 0,
      };

      expect(session.mode).toBe('divergent');
      expect(session.maxDivergence).toBe(8);
      expect(session.maxDepth).toBe(5);
      expect(session.currentDepth).toBe(0);
    });

    it('should have valid default values for divergent configuration', () => {
      const session: Partial<DivergentSession> = {
        mode: 'divergent',
        maxDivergence: 8,
        maxDepth: 5,
        currentDepth: 0,
      };

      expect(session.maxDivergence).toBeGreaterThan(0);
      expect(session.maxDepth).toBeGreaterThan(0);
      expect(session.currentDepth).toBeGreaterThanOrEqual(0);
    });
  });

  describe('DivergentStep', () => {
    it('should define DivergentStep with tree structure metadata', () => {
      const step: DivergentStep = {
        stepId: 'step-123',
        name: 'Test Divergent Step',
        epoch: 1,
        entityId: 'entity-123',
        entityType: 'skillResponse',
        status: 'executing',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        // Divergent specific fields
        nodeType: 'summary',
        depth: 1,
        parentStepId: 'parent-step-123',
        convergenceGroup: 'group-1',
        completionScore: 0.85,
      };

      expect(step.nodeType).toBe('summary');
      expect(step.depth).toBe(1);
      expect(step.parentStepId).toBe('parent-step-123');
      expect(step.convergenceGroup).toBe('group-1');
      expect(step.completionScore).toBe(0.85);
    });

    it('should support execution node type', () => {
      const executionStep: Partial<DivergentStep> = {
        nodeType: 'execution',
        depth: 2,
        parentStepId: 'summary-step-123',
      };

      expect(executionStep.nodeType).toBe('execution');
      expect(['summary', 'execution']).toContain(executionStep.nodeType);
    });
  });

  describe('ConvergenceResult', () => {
    it('should define complete convergence result structure', () => {
      const result: ConvergenceResult = {
        summary: 'Comprehensive analysis summary',
        completionScore: 0.92,
        confidenceScore: 0.88,
        shouldContinue: false,
        readyForFinalOutput: true,
        missingAreas: ['regulatory analysis', 'future projections'],
      };

      expect(result.summary).toBeDefined();
      expect(result.completionScore).toBeGreaterThanOrEqual(0);
      expect(result.completionScore).toBeLessThanOrEqual(1);
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
      expect(typeof result.shouldContinue).toBe('boolean');
      expect(typeof result.readyForFinalOutput).toBe('boolean');
    });

    it('should handle completion score thresholds correctly', () => {
      const highCompletion: ConvergenceResult = {
        summary: 'Complete analysis',
        completionScore: 0.95,
        confidenceScore: 0.9,
        shouldContinue: false,
        readyForFinalOutput: true,
      };

      const lowCompletion: ConvergenceResult = {
        summary: 'Partial analysis',
        completionScore: 0.65,
        confidenceScore: 0.7,
        shouldContinue: true,
        readyForFinalOutput: false,
      };

      expect(highCompletion.readyForFinalOutput).toBe(true);
      expect(lowCompletion.shouldContinue).toBe(true);
    });
  });

  describe('NextActionDecision', () => {
    it('should define valid action decisions', () => {
      const continueDecision: NextActionDecision = {
        action: 'continue_divergence',
        reason: 'Completion score below threshold',
        nextDepth: 2,
        focusAreas: ['market analysis', 'competitor research'],
      };

      const finalOutputDecision: NextActionDecision = {
        action: 'generate_final_output',
        reason: 'High completion score achieved',
        recommendedSkill: 'generateDoc',
      };

      expect(['continue_divergence', 'generate_final_output', 'force_final_output']).toContain(
        continueDecision.action,
      );
      expect(['continue_divergence', 'generate_final_output', 'force_final_output']).toContain(
        finalOutputDecision.action,
      );
      expect(['generateDoc', 'codeArtifacts']).toContain(finalOutputDecision.recommendedSkill);
    });
  });
});
