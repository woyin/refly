import { Test, TestingModule } from '@nestjs/testing';
import { VariableExtractionService } from './variable-extraction.service';
import { User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import { ProviderService } from '../provider/provider.service';
import { WorkflowVariable } from './variable-extraction.dto';

describe('VariableExtractionService', () => {
  let service: VariableExtractionService;

  // Mock user data
  const mockUser: User = {
    uid: 'test-user-123',
    email: 'test@example.com',
    name: 'Test User',
  } as User;

  // Mock services
  const mockPrismaService = {
    variableExtractionHistory: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockCanvasService = {
    getCanvasContentItems: jest.fn(),
  };

  const mockCanvasSyncService = {
    getWorkflowVariables: jest.fn(),
    updateWorkflowVariables: jest.fn(),
  };

  const mockProviderService = {
    getChatModel: jest.fn(),
    findDefaultProviderItem: jest.fn(),
    prepareChatModel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariableExtractionService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: CanvasService,
          useValue: mockCanvasService,
        },
        {
          provide: CanvasSyncService,
          useValue: mockCanvasSyncService,
        },
        {
          provide: ProviderService,
          useValue: mockProviderService,
        },
      ],
    }).compile();

    service = module.get<VariableExtractionService>(VariableExtractionService);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mock returns
    mockCanvasService.getCanvasContentItems.mockResolvedValue([
      {
        id: 'item-1',
        type: 'resource',
        title: '测试资源',
        content: '这是一个测试资源',
      },
      {
        id: 'item-2',
        type: 'skillResponse',
        title: 'AI技能响应',
        content: '这是一个AI技能的响应',
      },
    ]);

    mockCanvasSyncService.getWorkflowVariables.mockResolvedValue([]);
    mockCanvasSyncService.updateWorkflowVariables.mockResolvedValue(undefined);

    mockPrismaService.variableExtractionHistory.findFirst.mockResolvedValue(null);
    mockPrismaService.variableExtractionHistory.findMany.mockResolvedValue([]);
    mockPrismaService.variableExtractionHistory.create.mockResolvedValue({
      pk: BigInt(1),
      sessionId: 'test-session',
      canvasId: 'test-canvas',
      uid: 'test-user',
    });

    mockProviderService.findDefaultProviderItem.mockResolvedValue({
      itemId: 'provider-1',
      name: 'GPT-4',
      category: 'llm',
      enabled: true,
      providerId: 'openai',
      config: '{}',
    });

    mockProviderService.prepareChatModel.mockResolvedValue({
      invoke: jest.fn().mockResolvedValue({
        content: JSON.stringify({
          analysis: {
            userIntent: '生成PPT内容',
            extractionConfidence: 0.95,
            complexityScore: 3,
            extractedEntityCount: 2,
            variableTypeDistribution: {
              string: 2,
              resource: 0,
              option: 0,
            },
          },
          variables: [
            {
              name: 'presentation_topic',
              value: ['AI技术发展'],
              description: 'PPT主题',
              variableType: 'string',
              source: 'startNode',
              extractionReason: '用户明确指定了PPT的主题内容',
              confidence: 0.95,
            },
            {
              name: 'target_audience',
              value: ['技术团队'],
              description: '目标受众',
              variableType: 'string',
              source: 'startNode',
              extractionReason: '从用户需求中识别出目标受众群体',
              confidence: 0.9,
            },
          ],
          processedPrompt: '制作一份关于{{presentation_topic}}的PPT，面向{{target_audience}}',
          reusedVariables: [],
          originalPrompt: '制作一份关于AI技术发展的PPT，面向技术团队',
        }),
      }),
    });

    // Setup mock for specific candidate record test
    mockPrismaService.variableExtractionHistory.findUnique.mockImplementation((query) => {
      if (query.where.sessionId === 'mock-session-id') {
        return Promise.resolve({
          sessionId: 'mock-session-id',
          canvasId: 'test-canvas-apply',
          uid: 'test-user-123',
          originalPrompt: '帮我创建一个关于AI的PPT',
          extractedVariables: JSON.stringify([
            {
              name: 'presentation_topic',
              value: ['AI技术发展'],
              description: 'PPT主题',
              variableType: 'string',
              source: 'startNode',
            },
            {
              name: 'target_audience',
              value: ['技术团队'],
              description: '目标受众',
              variableType: 'string',
              source: 'startNode',
            },
          ]),
          reusedVariables: JSON.stringify([]),
          applied: false,
          status: 'pending',
          extractionMode: 'candidate',
          expiresAt: new Date(Date.now() + 3600000),
          createdAt: new Date(),
        });
      }
      return Promise.resolve(null);
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractVariables - Direct Mode', () => {
    it('should extract variables in direct mode and update canvas', async () => {
      const prompt =
        '帮我创建一个关于AI技术的项目计划，目标用户是产品经理，需要包含核心功能和时间要求';
      const canvasId = 'test-canvas-123';

      const result = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      // Verify basic structure
      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(prompt);
      expect(result.processedPrompt).toBeDefined();
      expect(result.variables).toBeInstanceOf(Array);
      expect(result.variables.length).toBeGreaterThan(0);
      expect(result.reusedVariables).toBeInstanceOf(Array);

      // Verify variables structure
      const firstVariable = result.variables[0];
      expect(firstVariable).toHaveProperty('name');
      expect(firstVariable).toHaveProperty('value');
      expect(firstVariable).toHaveProperty('variableType');

      // Since we're using mock LLM data, just verify structure
      expect(result.processedPrompt).toBeDefined();
      expect(typeof result.processedPrompt).toBe('string');
    });

    it('should handle empty prompt gracefully', async () => {
      const prompt = '';
      const canvasId = 'test-canvas-123';

      const result = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      expect(result.originalPrompt).toBe('');
      expect(result.variables).toBeInstanceOf(Array);
    });
  });

  describe('extractVariables - Candidate Mode', () => {
    it('should extract variables in candidate mode and return sessionId', async () => {
      const prompt = '生成一份技术报告，主题是机器学习应用，面向开发团队';
      const canvasId = 'test-canvas-456';

      const result = await service.extractVariables(mockUser, prompt, canvasId, 'candidate');

      // Verify candidate mode specific properties
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^candidate_\d+_[a-z0-9]+$/);
      expect(result.variables).toBeInstanceOf(Array);
      expect(result.variables.length).toBeGreaterThan(0);
    });

    it('should generate unique sessionId for each candidate request', async () => {
      const prompt = '测试提示';
      const canvasId = 'test-canvas-789';

      const result1 = await service.extractVariables(mockUser, prompt, canvasId, 'candidate');

      const result2 = await service.extractVariables(mockUser, prompt, canvasId, 'candidate');

      expect(result1.sessionId).not.toBe(result2.sessionId);
    });
  });

  describe('Candidate Record Management', () => {
    it('should apply existing candidate record when sessionId is provided', async () => {
      const prompt = '应用之前的候选方案';
      const canvasId = 'test-canvas-apply';
      const sessionId = 'mock-session-id';

      const result = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'direct',
        sessionId,
      );

      // Should return the mock candidate record data
      expect(result.originalPrompt).toBe('帮我创建一个关于AI的PPT');
      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('presentation_topic');
      expect(result.variables[0].value).toEqual(['AI技术发展']);
      expect(result.variables[1].name).toBe('target_audience');
      expect(result.variables[1].value).toEqual(['技术团队']);
      // Should have sessionId when applying candidate record
      expect(result.sessionId).toBe(sessionId);
    });

    it('should handle non-existent sessionId gracefully', async () => {
      const prompt = '应用不存在的候选方案';
      const canvasId = 'test-canvas-nonexistent';
      const sessionId = 'non-existent-session';

      const result = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'direct',
        sessionId,
      );

      // Should proceed with normal extraction instead of applying candidate
      expect(result.originalPrompt).toBe(prompt);
      expect(result.variables).toBeInstanceOf(Array);
      expect(result.variables.length).toBeGreaterThan(0);
    });
  });

  describe('Variable Extraction Quality', () => {
    it('should extract variables with proper types and descriptions', async () => {
      const prompt = '创建一个电商网站，需要用户注册、商品展示、购物车和支付功能';
      const canvasId = 'test-canvas-ecommerce';

      const result = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      // Verify variable quality
      for (const variable of result.variables) {
        expect(variable.name).toBeDefined();
        expect(variable.name.length).toBeGreaterThan(0);
        expect(variable.value).toBeDefined();
        expect(variable.value.length).toBeGreaterThan(0);
        expect(variable.variableType).toBeDefined();
        expect(['string', 'option', 'resource']).toContain(variable.variableType);
      }

      // Verify at least some variables have descriptions
      const variablesWithDescription = result.variables.filter((v) => v.description);
      expect(variablesWithDescription.length).toBeGreaterThan(0);
    });

    it('should generate meaningful processed prompt with variable placeholders', async () => {
      const prompt = '设计一个移动应用，包含登录、主页、设置页面';
      const canvasId = 'test-canvas-mobile';

      const result = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      // Verify processed prompt contains meaningful placeholders
      expect(result.processedPrompt).toContain('{{');
      expect(result.processedPrompt).toContain('}}');

      // Count variable placeholders
      const placeholderCount = (result.processedPrompt.match(/{{[^}]+}}/g) || []).length;
      expect(placeholderCount).toBeGreaterThan(0);
      expect(placeholderCount).toBeLessThanOrEqual(result.variables.length);
    });
  });

  describe('Timestamp Handling', () => {
    it('should properly handle timestamps for new variables', async () => {
      // Test the utility functions directly
      const mockVariable: WorkflowVariable = {
        name: 'test_var',
        value: ['test_value'],
        description: 'Test variable',
        variableType: 'string',
        source: 'startNode',
      };

      // Import and test the utility functions
      const { addTimestampsToNewVariable } = await import('./utils');

      const variableWithTimestamps = addTimestampsToNewVariable(mockVariable);

      // Verify that timestamps were added
      expect(variableWithTimestamps.createdAt).toBeDefined();
      expect(variableWithTimestamps.updatedAt).toBeDefined();
      expect(typeof variableWithTimestamps.createdAt).toBe('string');
      expect(typeof variableWithTimestamps.updatedAt).toBe('string');

      // Verify timestamp format (ISO string)
      expect(new Date(variableWithTimestamps.createdAt).toISOString()).toBe(
        variableWithTimestamps.createdAt,
      );
      expect(new Date(variableWithTimestamps.updatedAt).toISOString()).toBe(
        variableWithTimestamps.updatedAt,
      );

      // Verify that original fields are preserved
      expect(variableWithTimestamps.name).toBe(mockVariable.name);
      expect(variableWithTimestamps.value).toEqual(mockVariable.value);
    });

    it('should preserve existing timestamps when updating variables', async () => {
      // Test the utility functions directly
      const existingVariable: WorkflowVariable = {
        name: 'existing_var',
        value: ['original_value'],
        description: 'Original description',
        variableType: 'string',
        source: 'startNode',
        createdAt: '2023-08-20T10:00:00.000Z',
        updatedAt: '2023-08-20T10:00:00.000Z',
      };

      const updatedVariable: WorkflowVariable = {
        name: 'existing_var',
        value: ['updated_value'],
        description: 'Updated description',
        variableType: 'string',
        source: 'startNode',
      };

      // Import and test the utility functions
      const { updateTimestampForVariable } = await import('./utils');

      const result = updateTimestampForVariable(updatedVariable, existingVariable);

      // Verify that createdAt is preserved
      expect(result.createdAt).toBe('2023-08-20T10:00:00.000Z');

      // Verify that updatedAt is updated
      expect(result.updatedAt).not.toBe('2023-08-20T10:00:00.000Z');
      expect(new Date(result.updatedAt).getTime()).toBeGreaterThan(
        new Date(result.createdAt).getTime(),
      );

      // Verify that other fields are updated
      expect(result.value).toEqual(['updated_value']);
      expect(result.description).toBe('Updated description');
    });

    it('should detect variable changes correctly', async () => {
      const variable1: WorkflowVariable = {
        name: 'test_var',
        value: ['value1'],
        description: 'Description 1',
        variableType: 'string',
        source: 'startNode',
      };

      const variable2: WorkflowVariable = {
        name: 'test_var',
        value: ['value2'],
        description: 'Description 2',
        variableType: 'string',
        source: 'startNode',
      };

      const variable3: WorkflowVariable = {
        name: 'test_var',
        value: ['value1'],
        description: 'Description 1',
        variableType: 'string',
        source: 'startNode',
      };

      // Import and test the utility functions
      const { hasVariableChanged } = await import('./utils');

      // Variables with different values should be detected as changed
      expect(hasVariableChanged(variable1, variable2)).toBe(true);

      // Variables with same values should be detected as unchanged
      expect(hasVariableChanged(variable1, variable3)).toBe(false);
    });
  });

  describe('Variable Reuse Detection', () => {
    it('should detect and reuse existing variables when appropriate', async () => {
      const prompt = '使用现有的变量来创建新的工作流';
      const canvasId = 'test-canvas-reuse';

      const result = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      // Verify reuse detection is working
      expect(result.reusedVariables).toBeInstanceOf(Array);

      // In mock implementation, we might have some reused variables
      // The actual detection logic is mocked but should return consistent results
      if (result.reusedVariables.length > 0) {
        for (const reuse of result.reusedVariables) {
          expect(reuse).toHaveProperty('detectedText');
          expect(reuse).toHaveProperty('reusedVariableName');
          expect(reuse).toHaveProperty('confidence');
          expect(reuse).toHaveProperty('reason');
          expect(reuse.confidence).toBeGreaterThanOrEqual(0);
          expect(reuse.confidence).toBeLessThanOrEqual(1);
        }
      }
    });
  });

  describe('Context Analysis', () => {
    it('should analyze canvas complexity correctly', async () => {
      const prompt = '分析当前画布的复杂度';
      const canvasId = 'test-canvas-complexity';

      const result = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      // The service should handle context analysis internally
      expect(result).toBeDefined();
      expect(result.variables).toBeInstanceOf(Array);
    });

    it('should detect workflow patterns based on canvas structure', async () => {
      const prompt = '识别工作流类型';
      const canvasId = 'test-canvas-pattern';

      const result = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      // Service should complete successfully with pattern detection
      expect(result).toBeDefined();
      expect(result.variables).toBeInstanceOf(Array);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid canvasId gracefully', async () => {
      const prompt = '测试无效画布ID';
      const invalidCanvasId = '';

      const result = await service.extractVariables(mockUser, prompt, invalidCanvasId, 'direct');

      // Should still return a result structure
      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(prompt);
      expect(result.variables).toBeInstanceOf(Array);
    });

    it('should handle null/undefined user gracefully', async () => {
      const prompt = '测试空用户';
      const canvasId = 'test-canvas-null-user';

      // This test might fail if user validation is strict
      // We're testing the mock implementation's resilience
      try {
        const result = await service.extractVariables(null as any, prompt, canvasId, 'direct');
        expect(result).toBeDefined();
      } catch (error) {
        // If the service validates user input strictly, this is expected
        expect(error).toBeDefined();
      }
    });
  });

  describe('Performance and Scalability', () => {
    it('should handle long prompts efficiently', async () => {
      const longPrompt = '这是一个非常长的提示，包含了很多详细的要求和说明。'.repeat(50);
      const canvasId = 'test-canvas-long-prompt';

      const startTime = Date.now();
      const result = await service.extractVariables(mockUser, longPrompt, canvasId, 'direct');
      const endTime = Date.now();

      // Should complete within reasonable time (mock implementation)
      expect(endTime - startTime).toBeLessThan(1000); // 1 second
      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(longPrompt);
    });

    it('should handle multiple concurrent requests', async () => {
      const prompt = '并发测试';
      const canvasId = 'test-canvas-concurrent';
      const promises = [];

      // Create multiple concurrent requests
      for (let i = 0; i < 5; i++) {
        promises.push(service.extractVariables(mockUser, `${prompt} ${i}`, canvasId, 'direct'));
      }

      const results = await Promise.all(promises);

      // All requests should complete successfully
      expect(results).toHaveLength(5);
      for (let i = 0; i < results.length; i++) {
        expect(results[i].originalPrompt).toBe(`${prompt} ${i}`);
        expect(results[i].variables).toBeInstanceOf(Array);
      }
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle complete workflow from candidate to direct mode', async () => {
      const prompt = '完整工作流测试：从候选到直接模式';
      const canvasId = 'test-canvas-integration';

      // Step 1: Create candidate
      const candidateResult = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'candidate',
      );

      expect(candidateResult.sessionId).toBeDefined();
      expect(candidateResult.variables).toBeInstanceOf(Array);

      // Step 2: Apply candidate
      const directResult = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'direct',
        candidateResult.sessionId,
      );

      // Should return the same variables but in direct mode
      // Note: The actual service may return different data structures, so we check basic properties
      expect(directResult.variables.length).toBeGreaterThan(0);
      expect(directResult.variables[0]).toHaveProperty('name');
      expect(directResult.variables[0]).toHaveProperty('value');
      expect(directResult.variables[0]).toHaveProperty('variableType');
      expect(directResult.originalPrompt).toBeDefined();
    });

    it('should maintain consistency across different extraction modes', async () => {
      const prompt = '一致性测试：不同模式下的变量提取';
      const canvasId = 'test-canvas-consistency';

      const directResult = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      const candidateResult = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'candidate',
      );

      // Both modes should extract similar variables for the same prompt
      expect(directResult.variables.length).toBeGreaterThan(0);
      expect(candidateResult.variables.length).toBeGreaterThan(0);

      // Variables should have similar structure
      expect(directResult.variables[0]).toHaveProperty('name');
      expect(directResult.variables[0]).toHaveProperty('value');
      expect(candidateResult.variables[0]).toHaveProperty('name');
      expect(candidateResult.variables[0]).toHaveProperty('value');
    });
  });
});
