import { Test, TestingModule } from '@nestjs/testing';
import { DivergentEngine } from './divergent-engine';
import { ConvergenceResult } from './types/divergent.types';

describe('DivergentEngine', () => {
  let engine: DivergentEngine;
  let module: TestingModule;

  beforeEach(async () => {
    const mockChatModel = {
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          tasks: [
            { name: 'task1', skillName: 'webSearch', parameters: { query: 'test' } },
            { name: 'task2', skillName: 'commonQnA', parameters: { query: 'analyze' } },
          ],
        }),
      }),
    };

    module = await Test.createTestingModule({
      providers: [DivergentEngine, { provide: 'CHAT_MODEL', useValue: mockChatModel }],
    }).compile();

    engine = module.get<DivergentEngine>(DivergentEngine);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Task Divergence', () => {
    it('should generate multiple divergent tasks from summary content', async () => {
      const mockSummaryContent = 'Analyze the renewable energy market in China';
      const mockCanvasContext = {
        nodes: [],
        connections: [],
      };

      const tasks = await engine.generateDivergentTasks(
        mockSummaryContent,
        mockCanvasContext,
        8, // maxDivergence
        1, // currentDepth
      );

      expect(tasks).toBeDefined();
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks.length).toBeLessThanOrEqual(8);

      // Each task should have required properties
      for (const task of tasks) {
        expect(task).toHaveProperty('name');
        expect(task).toHaveProperty('skillName');
        expect(task).toHaveProperty('parameters');
        expect(task).toHaveProperty('depth');
        expect(task.depth).toBe(1);
      }
    });

    it('should respect maxDivergence limit', async () => {
      const tasks = await engine.generateDivergentTasks(
        'Complex analysis task',
        { nodes: [], connections: [] },
        3, // maxDivergence = 3
        1,
      );

      expect(tasks.length).toBeLessThanOrEqual(3);
    });
  });

  describe('Result Convergence', () => {
    it('should converge multiple task results into summary', async () => {
      const mockTaskResults = [
        {
          stepId: 'step-1',
          skill: 'webSearch',
          result: { content: 'Search result about renewable energy market size' },
        },
        {
          stepId: 'step-2',
          skill: 'commonQnA',
          result: { content: 'Analysis of market trends and growth patterns' },
        },
        {
          stepId: 'step-3',
          skill: 'librarySearch',
          result: { content: 'Academic research on renewable energy policies' },
        },
      ];

      const convergenceResult = await engine.convergeResults(
        mockTaskResults,
        'Analyze renewable energy market in China',
        { nodes: [], connections: [] },
        2, // currentDepth
      );

      expect(convergenceResult).toBeDefined();
      expect(convergenceResult.summary).toBeDefined();
      expect(typeof convergenceResult.summary).toBe('string');
      expect(convergenceResult.completionScore).toBeGreaterThanOrEqual(0);
      expect(convergenceResult.completionScore).toBeLessThanOrEqual(1);
      expect(convergenceResult.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(convergenceResult.confidenceScore).toBeLessThanOrEqual(1);
      expect(typeof convergenceResult.shouldContinue).toBe('boolean');
      expect(convergenceResult.readyForFinalOutput).toBeDefined();
      expect(typeof convergenceResult.readyForFinalOutput).toBe('boolean');
    });

    it.skip('should handle partial failures robustly', async () => {
      const partialResults = [
        {
          stepId: 'step-1',
          skill: 'webSearch',
          result: { content: 'Successful search result' },
        },
        // Note: Missing step-2 (failed task)
        {
          stepId: 'step-3',
          skill: 'commonQnA',
          result: { content: 'Successful analysis result' },
        },
      ];

      const result = await engine.convergeResults(
        partialResults,
        'Original query',
        { nodes: [], connections: [] },
        1,
      );

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.completionScore).toBeGreaterThanOrEqual(0);
      expect(result.completionScore).toBeLessThanOrEqual(1);
      expect(result.confidenceScore).toBeDefined();
      expect(result.confidenceScore).toBeLessThan(1); // Should reflect partial failure
      expect(result.shouldContinue).toBeDefined();
      expect(result.readyForFinalOutput).toBeDefined();
      expect(result.missingAreas).toBeDefined(); // Should identify missing areas
    });
  });

  describe('Completion Assessment', () => {
    it('should assess high completion correctly', async () => {
      const highQualityResult: ConvergenceResult = {
        summary: 'Comprehensive analysis of renewable energy market with detailed insights',
        completionScore: 0.95,
        confidenceScore: 0.9,
        shouldContinue: false,
        readyForFinalOutput: true,
      };

      const decision = await engine.assessCompletion(
        highQualityResult,
        'Original user query',
        3, // currentDepth
        5, // maxDepth
      );

      expect(decision.action).toBe('generate_final_output');
      expect(decision.reason).toBeDefined();
      expect(decision.recommendedSkill).toMatch(/generateDoc|codeArtifacts/);
    });

    it('should assess low completion and continue divergence', async () => {
      const lowQualityResult: ConvergenceResult = {
        summary: 'Initial basic analysis',
        completionScore: 0.65,
        confidenceScore: 0.6,
        shouldContinue: true,
        readyForFinalOutput: false,
        missingAreas: ['market analysis', 'competitor research'],
      };

      const decision = await engine.assessCompletion(
        lowQualityResult,
        'Complex analysis task',
        2, // currentDepth
        5, // maxDepth
      );

      expect(decision.action).toBe('continue_divergence');
      expect(decision.nextDepth).toBe(3);
      expect(decision.focusAreas).toBeDefined();
      expect(decision.focusAreas.length).toBeGreaterThan(0);
    });

    it('should force final output at max depth', async () => {
      const mediumResult: ConvergenceResult = {
        summary: 'Medium quality analysis',
        completionScore: 0.75,
        confidenceScore: 0.7,
        shouldContinue: true,
        readyForFinalOutput: false,
      };

      const decision = await engine.assessCompletion(
        mediumResult,
        'Analysis task',
        5, // currentDepth = maxDepth
        5, // maxDepth
      );

      expect(decision.action).toBe('force_final_output');
      expect(decision.reason).toContain('max depth');
    });
  });
});
