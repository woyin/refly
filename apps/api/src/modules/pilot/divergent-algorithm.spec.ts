import { Test, TestingModule } from '@nestjs/testing';
import { DivergentEngine } from './divergent-engine';
import { BaseChatModel } from '@refly/providers';

describe('DivergentAlgorithm Integration', () => {
  let engine: DivergentEngine;
  let mockModel: jest.Mocked<BaseChatModel>;
  let module: TestingModule;

  beforeEach(async () => {
    mockModel = {
      invoke: jest.fn(),
    } as any;

    module = await Test.createTestingModule({
      providers: [
        DivergentEngine,
        {
          provide: 'CHAT_MODEL',
          useValue: mockModel,
        },
      ],
    }).compile();

    engine = module.get<DivergentEngine>(DivergentEngine);
  });

  afterEach(async () => {
    await module.close();
  });

  describe('Real LLM Task Generation', () => {
    it('should generate divergent tasks using LLM', async () => {
      // Mock LLM response for task generation
      const mockLLMResponse = JSON.stringify({
        tasks: [
          {
            name: 'market_research',
            skillName: 'webSearch',
            parameters: {
              query: 'renewable energy market size China 2024',
              maxResults: 5,
            },
            priority: 1,
          },
          {
            name: 'policy_analysis',
            skillName: 'commonQnA',
            parameters: {
              query: 'What are the key renewable energy policies in China?',
              context: 'renewable energy analysis',
            },
            priority: 2,
          },
          {
            name: 'academic_research',
            skillName: 'librarySearch',
            parameters: {
              query: 'China renewable energy academic research',
              limit: 10,
            },
            priority: 3,
          },
        ],
      });

      mockModel.invoke.mockResolvedValue({
        content: mockLLMResponse,
      } as any);

      const tasks = await engine.generateDivergentTasks(
        'Analyze the renewable energy market in China',
        { nodes: [], connections: [] },
        8,
        1,
      );

      expect(mockModel.invoke).toHaveBeenCalledWith(
        expect.stringContaining('task decomposition AI'),
      );

      expect(tasks).toHaveLength(3);
      expect(tasks[0].name).toBe('market_research');
      expect(tasks[0].skillName).toBe('webSearch');
      expect(tasks[1].name).toBe('policy_analysis');
      expect(tasks[1].skillName).toBe('commonQnA');
    });

    it('should handle LLM parsing failures gracefully', async () => {
      // Mock invalid LLM response
      mockModel.invoke.mockResolvedValue({
        content: 'Invalid JSON response',
      } as any);

      const tasks = await engine.generateDivergentTasks(
        'Test query',
        { nodes: [], connections: [] },
        5,
        1,
      );

      // Should fallback to mock implementation
      expect(tasks).toBeDefined();
      expect(Array.isArray(tasks)).toBe(true);
      expect(tasks.length).toBeGreaterThan(0);
    });
  });

  describe('Real LLM Convergence', () => {
    it('should converge results using LLM', async () => {
      const mockLLMResponse = JSON.stringify({
        summary:
          'Based on comprehensive research, the renewable energy market in China shows significant growth with strong government support and technological advancement.',
        completionScore: 0.92,
        confidenceScore: 0.88,
        shouldContinue: false,
        readyForFinalOutput: true,
        keyInsights: ['Strong government policy support', 'Rapid technological advancement'],
      });

      mockModel.invoke.mockResolvedValue({
        content: mockLLMResponse,
      } as any);

      const taskResults = [
        {
          stepId: 'step-1',
          skill: 'webSearch',
          result: { content: 'Market size data and trends' },
        },
        {
          stepId: 'step-2',
          skill: 'commonQnA',
          result: { content: 'Policy analysis results' },
        },
      ];

      const result = await engine.convergeResults(
        taskResults,
        'Analyze renewable energy market in China',
        { nodes: [], connections: [] },
        1,
      );

      expect(mockModel.invoke).toHaveBeenCalledWith(
        expect.stringContaining('analysis convergence AI'),
      );

      expect(result.summary).toContain('renewable energy market in China');
      expect(result.completionScore).toBe(0.92);
      expect(result.confidenceScore).toBe(0.88);
      expect(result.shouldContinue).toBe(false);
      expect(result.readyForFinalOutput).toBe(true);
    });
  });
});
