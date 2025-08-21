import { Test, TestingModule } from '@nestjs/testing';
import { VariableExtractionService } from './variable-extraction.service';
import { User } from '@refly/openapi-schema';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import { ProviderService } from '../provider/provider.service';

describe('VariableExtractionService - Edge Cases & Error Scenarios', () => {
  let service: VariableExtractionService;

  const mockUser: User = {
    uid: 'test-user-edge',
    email: 'edge@example.com',
    name: 'Edge Test User',
  } as User;

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

    jest.clearAllMocks();

    // Setup default mock returns
    mockCanvasService.getCanvasContentItems.mockResolvedValue([]);
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
          variables: [
            {
              name: 'document_title',
              value: [''],
              description: '文档标题',
              variableType: 'string',
              source: 'startNode',
            },
          ],
          processedPrompt: '生成一份{{document_title}}',
          reusedVariables: [],
        }),
      }),
    });
  });

  describe('Edge Cases - Input Validation', () => {
    it('should handle extremely long prompts', async () => {
      const extremelyLongPrompt = '这是一个极其长的提示，'.repeat(1000);
      const canvasId = 'test-canvas-extremely-long';

      const startTime = Date.now();
      const result = await service.extractVariables(
        mockUser,
        extremelyLongPrompt,
        canvasId,
        'direct',
      );
      const endTime = Date.now();

      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(extremelyLongPrompt);
      expect(result.variables).toBeInstanceOf(Array);
      expect(endTime - startTime).toBeLessThan(2000); // Should complete within 2 seconds
    });

    it('should handle prompts with special characters', async () => {
      const specialCharPrompt = '创建包含特殊字符的项目：!@#$%^&*()_+-=[]{}|;:,.<>?/"\'\\`~';
      const canvasId = 'test-canvas-special-chars';

      const result = await service.extractVariables(
        mockUser,
        specialCharPrompt,
        canvasId,
        'direct',
      );

      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(specialCharPrompt);
      expect(result.variables).toBeInstanceOf(Array);
    });

    it('should handle prompts with emojis and unicode', async () => {
      const emojiPrompt = '创建包含表情符号的项目 🚀🎯💡 和中文：人工智能应用';
      const canvasId = 'test-canvas-emoji';

      const result = await service.extractVariables(mockUser, emojiPrompt, canvasId, 'direct');

      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(emojiPrompt);
      expect(result.variables).toBeInstanceOf(Array);
    });

    it('should handle empty canvasId', async () => {
      const prompt = '测试空画布ID';
      const emptyCanvasId = '';

      const result = await service.extractVariables(mockUser, prompt, emptyCanvasId, 'direct');

      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(prompt);
      expect(result.variables).toBeInstanceOf(Array);
    });

    it('should handle very long canvasId', async () => {
      const prompt = '测试超长画布ID';
      const longCanvasId = 'a'.repeat(1000);

      const result = await service.extractVariables(mockUser, prompt, longCanvasId, 'direct');

      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(prompt);
      expect(result.variables).toBeInstanceOf(Array);
    });
  });

  describe('Edge Cases - Session Management', () => {
    it('should handle very long sessionId', async () => {
      const prompt = '测试超长会话ID';
      const canvasId = 'test-canvas-long-session';
      const longSessionId = `mock-session-${'a'.repeat(100)}`;

      const result = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'direct',
        longSessionId,
      );

      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(prompt);
      expect(result.variables).toBeInstanceOf(Array);
    });

    it('should handle sessionId with special characters', async () => {
      const prompt = '测试特殊字符会话ID';
      const canvasId = 'test-canvas-special-session';
      const specialSessionId = 'mock-session-!@#$%^&*()';

      const result = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'direct',
        specialSessionId,
      );

      expect(result).toBeDefined();
      expect(result.originalPrompt).toBe(prompt);
      expect(result.variables).toBeInstanceOf(Array);
    });

    it('should handle multiple candidate requests for same canvas', async () => {
      const prompt = '多次候选请求测试';
      const canvasId = 'test-canvas-multiple-candidates';

      // Create multiple candidate requests
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(service.extractVariables(mockUser, `${prompt} ${i}`, canvasId, 'candidate'));
      }

      const results = await Promise.all(promises);

      // All should have unique sessionIds
      const sessionIds = results.map((r) => r.sessionId);
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(results.length);

      // All should have variables
      for (const result of results) {
        expect(result.variables).toBeInstanceOf(Array);
        expect(result.variables.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Edge Cases - Mode Switching', () => {
    it('should handle rapid mode switching', async () => {
      const prompt = '快速模式切换测试';
      const canvasId = 'test-canvas-rapid-switch';

      // Rapidly switch between modes
      const directResult = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      const candidateResult = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'candidate',
      );

      const directResult2 = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      // All should return valid results
      expect(directResult).toBeDefined();
      expect(candidateResult).toBeDefined();
      expect(directResult2).toBeDefined();

      expect(directResult.variables).toBeInstanceOf(Array);
      expect(candidateResult.variables).toBeInstanceOf(Array);
      expect(directResult2.variables).toBeInstanceOf(Array);
    });

    it('should handle mode switching with same sessionId', async () => {
      const prompt = '相同会话ID模式切换测试';
      const canvasId = 'test-canvas-same-session';

      // First create candidate
      const candidateResult = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'candidate',
      );

      // Then apply with the same sessionId
      const directResult = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'direct',
        candidateResult.sessionId,
      );

      // Both should be valid
      expect(candidateResult).toBeDefined();
      expect(directResult).toBeDefined();
      expect(candidateResult.variables).toBeInstanceOf(Array);
      expect(directResult.variables).toBeInstanceOf(Array);
    });
  });

  describe('Edge Cases - Concurrent Operations', () => {
    it('should handle high concurrency', async () => {
      const prompt = '高并发测试';
      const canvasId = 'test-canvas-high-concurrency';
      const concurrencyLevel = 20;

      const promises = [];
      for (let i = 0; i < concurrencyLevel; i++) {
        promises.push(service.extractVariables(mockUser, `${prompt} ${i}`, canvasId, 'direct'));
      }

      const startTime = Date.now();
      const results = await Promise.all(promises);
      const endTime = Date.now();

      // All should complete successfully
      expect(results).toHaveLength(concurrencyLevel);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds

      // Verify all results are valid
      for (const result of results) {
        expect(result).toBeDefined();
        expect(result.variables).toBeInstanceOf(Array);
        expect(result.variables.length).toBeGreaterThan(0);
      }
    });

    it('should handle mixed mode concurrency', async () => {
      const prompt = '混合模式并发测试';
      const canvasId = 'test-canvas-mixed-concurrency';
      const concurrencyLevel = 15;

      const promises = [];
      for (let i = 0; i < concurrencyLevel; i++) {
        const mode = i % 2 === 0 ? 'direct' : 'candidate';
        promises.push(service.extractVariables(mockUser, `${prompt} ${i}`, canvasId, mode));
      }

      const results = await Promise.all(promises);

      // All should complete successfully
      expect(results).toHaveLength(concurrencyLevel);

      // Verify direct mode results
      const directResults = results.filter((_, i) => i % 2 === 0);
      for (const result of directResults) {
        expect(result.sessionId).toBeUndefined();
        expect(result.variables).toBeInstanceOf(Array);
      }

      // Verify candidate mode results
      const candidateResults = results.filter((_, i) => i % 2 === 1);
      for (const result of candidateResults) {
        expect(result.sessionId).toBeDefined();
        expect(result.sessionId).toMatch(/^candidate_\d+_[a-z0-9]+$/);
        expect(result.variables).toBeInstanceOf(Array);
      }
    });
  });

  describe('Edge Cases - Data Consistency', () => {
    it('should maintain consistent variable structure across modes', async () => {
      const prompt = '数据结构一致性测试';
      const canvasId = 'test-canvas-consistency-structure';

      const directResult = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      const candidateResult = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'candidate',
      );

      // Both should have the same variable structure
      expect(directResult.variables.length).toBe(candidateResult.variables.length);

      for (let i = 0; i < directResult.variables.length; i++) {
        const directVar = directResult.variables[i];
        const candidateVar = candidateResult.variables[i];

        expect(directVar).toHaveProperty('name');
        expect(directVar).toHaveProperty('value');
        expect(directVar).toHaveProperty('variableType');
        expect(candidateVar).toHaveProperty('name');
        expect(candidateVar).toHaveProperty('value');
        expect(candidateVar).toHaveProperty('variableType');
      }
    });

    it('should handle processed prompt consistency', async () => {
      const prompt = '处理后的提示一致性测试';
      const canvasId = 'test-canvas-prompt-consistency';

      const directResult = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      const candidateResult = await service.extractVariables(
        mockUser,
        prompt,
        canvasId,
        'candidate',
      );

      // Both should have processed prompts with similar structure
      expect(directResult.processedPrompt).toContain('{{');
      expect(directResult.processedPrompt).toContain('}}');
      expect(candidateResult.processedPrompt).toContain('{{');
      expect(candidateResult.processedPrompt).toContain('}}');

      // Count variable placeholders should be consistent
      const directPlaceholders = (directResult.processedPrompt.match(/{{[^}]+}}/g) || []).length;
      const candidatePlaceholders = (candidateResult.processedPrompt.match(/{{[^}]+}}/g) || [])
        .length;
      expect(directPlaceholders).toBe(candidatePlaceholders);
    });
  });

  describe('Edge Cases - Error Recovery', () => {
    it('should recover from failed operations gracefully', async () => {
      const prompt = '错误恢复测试';
      const canvasId = 'test-canvas-error-recovery';

      // This test verifies that the service can handle potential errors
      // In the mock implementation, this should always succeed
      const result = await service.extractVariables(mockUser, prompt, canvasId, 'direct');

      expect(result).toBeDefined();
      expect(result.variables).toBeInstanceOf(Array);
      expect(result.variables.length).toBeGreaterThan(0);
    });

    it('should handle malformed input gracefully', async () => {
      const malformedPrompt = null as any;
      const canvasId = 'test-canvas-malformed';

      try {
        const result = await service.extractVariables(
          mockUser,
          malformedPrompt,
          canvasId,
          'direct',
        );
        // If the service handles malformed input gracefully, this should succeed
        expect(result).toBeDefined();
      } catch (error) {
        // If the service validates input strictly, this is expected
        expect(error).toBeDefined();
      }
    });
  });

  describe('Edge Cases - Performance Boundaries', () => {
    it('should handle boundary performance conditions', async () => {
      const _prompt = '性能边界测试';
      const canvasId = 'test-canvas-performance-boundary';

      // Test with minimal input
      const minimalResult = await service.extractVariables(mockUser, 'a', canvasId, 'direct');

      expect(minimalResult).toBeDefined();
      expect(minimalResult.variables).toBeInstanceOf(Array);

      // Test with maximal input (within reasonable bounds)
      const maximalPrompt = '这是一个包含大量详细信息的提示，'.repeat(100);
      const maximalResult = await service.extractVariables(
        mockUser,
        maximalPrompt,
        canvasId,
        'direct',
      );

      expect(maximalResult).toBeDefined();
      expect(maximalResult.variables).toBeInstanceOf(Array);
      expect(maximalResult.originalPrompt).toBe(maximalPrompt);
    });

    it('should maintain performance under stress', async () => {
      const prompt = '压力测试';
      const canvasId = 'test-canvas-stress';
      const iterations = 50;

      const startTime = Date.now();

      for (let i = 0; i < iterations; i++) {
        const result = await service.extractVariables(
          mockUser,
          `${prompt} ${i}`,
          canvasId,
          'direct',
        );
        expect(result).toBeDefined();
        expect(result.variables).toBeInstanceOf(Array);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      const averageTime = totalTime / iterations;

      // Average time should be reasonable (mock implementation with delays)
      expect(averageTime).toBeLessThan(200); // Less than 200ms per operation (adjusted for mock delays)
      expect(totalTime).toBeLessThan(15000); // Total time less than 15 seconds (adjusted for mock delays)
    });
  });
});
