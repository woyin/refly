import { Test, TestingModule } from '@nestjs/testing';
import { VariableExtractionService } from './variable-extraction.service';
import { PrismaService } from '../common/prisma.service';
import { CanvasService } from '../canvas/canvas.service';
import { CanvasSyncService } from '../canvas/canvas-sync.service';
import { ProviderService } from '../provider/provider.service';
import { User } from '@refly/openapi-schema';
import { WorkflowVariable } from './variable-extraction.dto';

describe('VariableExtractionService Integration Tests', () => {
  let service: VariableExtractionService;
  let prismaService: PrismaService;
  let canvasService: CanvasService;
  let canvasSyncService: CanvasSyncService;
  let providerService: ProviderService;

  // 使用真实数据库中的测试数据
  const testUser: User = {
    uid: 'u-eidtloxufefy9ugk9j7zeyap',
    email: 'tangqiyuan@refly.ai',
  };

  const testCanvasId = 'c-ug0jngf2oh0pnymmo0sezhol';
  const testSessionId = 'test_session_002';

  beforeAll(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VariableExtractionService,
        {
          provide: PrismaService,
          useValue: {
            variableExtractionHistory: {
              findUnique: jest.fn(),
              findFirst: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
        {
          provide: CanvasService,
          useValue: {
            getCanvasContentItems: jest.fn(),
          },
        },
        {
          provide: CanvasSyncService,
          useValue: {
            getWorkflowVariables: jest.fn(),
            updateWorkflowVariables: jest.fn(),
          },
        },
        {
          provide: ProviderService,
          useValue: {
            findDefaultProviderItem: jest.fn(),
            prepareChatModel: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<VariableExtractionService>(VariableExtractionService);
    prismaService = module.get<PrismaService>(PrismaService);
    canvasService = module.get<CanvasService>(CanvasService);
    canvasSyncService = module.get<CanvasSyncService>(CanvasSyncService);
    providerService = module.get<ProviderService>(ProviderService);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mocks for Canvas service
    jest.spyOn(canvasSyncService, 'getWorkflowVariables').mockResolvedValue([]);
    jest.spyOn(canvasSyncService, 'updateWorkflowVariables').mockResolvedValue(undefined);
  });

  describe('Database Integration Tests', () => {
    it('should retrieve candidate record from database', async () => {
      // Mock the database response with real data structure
      const mockCandidateRecord = {
        pk: BigInt(1),
        sessionId: testSessionId,
        canvasId: testCanvasId,
        uid: testUser.uid,
        triggerType: 'askAI_candidate',
        extractionMode: 'candidate',
        originalPrompt: '生成一份技术报告',
        processedPrompt:
          '生成一份{{报告主题}}技术报告，目标受众是{{目标受众}}，技术深度是{{技术深度}}',
        extractedVariables: JSON.stringify([
          {
            name: 'document_title',
            value: ['技术报告'],
            description: '报告主题',
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
          {
            name: 'technical_depth',
            value: ['深度'],
            description: '技术深度',
            variableType: 'string',
            source: 'startNode',
          },
        ]),
        reusedVariables: '[]',
        extractionConfidence: { toNumber: () => 0.92 } as any, // Mock Decimal type
        processingTimeMs: null,
        llmModel: null,
        status: 'pending',
        appliedAt: null,
        expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(prismaService.variableExtractionHistory, 'findUnique')
        .mockResolvedValue(mockCandidateRecord);

      const result = await (service as any).getCandidateRecord(testSessionId);

      expect(result).toBeDefined();
      expect(result?.sessionId).toBe(testSessionId);
      expect(result?.extractedVariables).toHaveLength(3);
      expect(result?.extractedVariables[0].name).toBe('document_title');
      expect(result?.applied).toBe(false);
      expect(result?.expiresAt).toBeInstanceOf(Date);
    });

    it('should save extraction history to database', async () => {
      const mockExtractionResult = {
        originalPrompt: '测试提示词',
        processedPrompt: '测试{{变量1}}提示词',
        variables: [
          {
            name: 'test_variable_1',
            value: ['测试值'],
            description: '测试变量',
            variableType: 'string',
            source: 'startNode',
          },
        ] as WorkflowVariable[],
        reusedVariables: [],
      };

      jest.spyOn(prismaService.variableExtractionHistory, 'create').mockResolvedValue({
        pk: BigInt(2),
        sessionId: null,
        canvasId: testCanvasId,
        uid: testUser.uid,
        triggerType: 'askAI_direct',
        extractionMode: 'direct',
        originalPrompt: mockExtractionResult.originalPrompt,
        processedPrompt: mockExtractionResult.processedPrompt,
        extractedVariables: JSON.stringify(mockExtractionResult.variables),
        reusedVariables: JSON.stringify(mockExtractionResult.reusedVariables),
        extractionConfidence: { toNumber: () => 0.88 } as any, // Mock Decimal type
        processingTimeMs: null,
        llmModel: null,
        status: 'applied',
        appliedAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        expiresAt: null,
      } as any);

      await (service as any).saveExtractionHistory(
        testUser,
        testCanvasId,
        mockExtractionResult,
        'direct',
      );

      expect(prismaService.variableExtractionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          canvasId: testCanvasId,
          uid: testUser.uid,
          triggerType: 'askAI_direct',
          extractionMode: 'direct',
          originalPrompt: mockExtractionResult.originalPrompt,
          processedPrompt: mockExtractionResult.processedPrompt,
          extractedVariables: JSON.stringify(mockExtractionResult.variables),
          reusedVariables: JSON.stringify(mockExtractionResult.reusedVariables),
          status: 'applied',
        }),
      });
    });

    it('should save candidate record to database', async () => {
      const mockExtractionResult = {
        originalPrompt: '候选模式测试',
        processedPrompt: '候选模式{{测试变量}}',
        variables: [
          {
            name: 'test_variable_2',
            value: [''],
            description: '测试变量描述',
            variableType: 'string',
            source: 'startNode',
          },
        ] as WorkflowVariable[],
        reusedVariables: [],
      };

      const mockCreatedRecord = {
        pk: BigInt(3),
        sessionId: 'candidate_test_123',
        canvasId: testCanvasId,
        uid: testUser.uid,
        triggerType: 'askAI_candidate',
        extractionMode: 'candidate',
        originalPrompt: mockExtractionResult.originalPrompt,
        processedPrompt: mockExtractionResult.processedPrompt,
        extractedVariables: JSON.stringify(mockExtractionResult.variables),
        reusedVariables: JSON.stringify(mockExtractionResult.reusedVariables),
        extractionConfidence: { toNumber: () => 0.9 } as any, // Mock Decimal type
        processingTimeMs: null,
        llmModel: null,
        status: 'pending',
        expiresAt: expect.any(Date),
        appliedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      jest
        .spyOn(prismaService.variableExtractionHistory, 'create')
        .mockResolvedValue(mockCreatedRecord as any);

      const sessionId = await (service as any).saveCandidateRecord(
        testUser,
        testCanvasId,
        mockExtractionResult,
      );

      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^candidate_\d+_[a-z0-9]+$/);
      expect(prismaService.variableExtractionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          sessionId: expect.stringMatching(/^candidate_\d+_[a-z0-9]+$/),
          canvasId: testCanvasId,
          uid: testUser.uid,
          triggerType: 'askAI_candidate',
          extractionMode: 'candidate',
          status: 'pending',
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should get recent variable patterns from database', async () => {
      const mockRecentRecords = [
        {
          extractedVariables: JSON.stringify([
            { name: 'project_name', description: '项目名称' },
            { name: 'time_requirement', description: '时间要求' },
          ]),
        },
        {
          extractedVariables: JSON.stringify([
            { name: 'report_topic', description: '报告主题' },
            { name: 'target_audience', description: '目标受众' },
          ]),
        },
      ];

      jest
        .spyOn(prismaService.variableExtractionHistory, 'findMany')
        .mockResolvedValue(mockRecentRecords as any);

      const patterns = await (service as any).getRecentVariablePatterns(testCanvasId);

      expect(patterns).toBeDefined();
      expect(patterns).toHaveLength(8); // 2 records * 2 variables each * (name + description)
      expect(patterns).toContain('project_name');
      expect(patterns).toContain('time_requirement');
      expect(patterns).toContain('report_topic');
      expect(patterns).toContain('target_audience');
      expect(patterns).toContain('项目名称'); // descriptions
      expect(patterns).toContain('时间要求');
      expect(patterns).toContain('报告主题');
      expect(patterns).toContain('目标受众');
    });

    it('should get last extraction time from database', async () => {
      const mockLastRecord = {
        createdAt: new Date('2024-01-15T10:00:00Z'),
      };

      jest
        .spyOn(prismaService.variableExtractionHistory, 'findFirst')
        .mockResolvedValue(mockLastRecord as any);

      const lastTime = await (service as any).getLastExtractionTime(testCanvasId);

      expect(lastTime).toBeDefined();
      expect(lastTime).toEqual(new Date('2024-01-15T10:00:00Z'));
    });
  });

  describe('Canvas Service Integration Tests', () => {
    it('should get canvas content items from CanvasService', async () => {
      const mockContentItems = [
        {
          id: 'item1',
          type: 'text',
          title: '测试内容项',
          content: '测试内容',
        },
        {
          id: 'item2',
          type: 'resource',
          title: '测试资源',
          content: '资源内容',
        },
      ];

      jest.spyOn(canvasService, 'getCanvasContentItems').mockResolvedValue(mockContentItems as any);

      const context = await service.buildEnhancedContext(testCanvasId, testUser);

      expect(context.contentItems).toBeDefined();
      expect(context.contentItems).toHaveLength(2);
      expect(context.contentItems[0].type).toBe('text');
      expect(context.contentItems[1].type).toBe('resource');
    });

    it('should handle canvas service errors gracefully', async () => {
      jest
        .spyOn(canvasService, 'getCanvasContentItems')
        .mockRejectedValue(new Error('Canvas service error'));

      const context = await service.buildEnhancedContext(testCanvasId, testUser);

      expect(context).toBeDefined();
      expect(context.canvasData.nodes).toHaveLength(0);
      expect(context.variables).toHaveLength(0);
      expect(context.contentItems).toHaveLength(0);
      expect(context.analysis.complexity).toBe(0);
      expect(context.analysis.workflowType).toBe('通用工作流');
    });
  });

  describe('Provider Service Integration Tests', () => {
    it('should get LLM provider from ProviderService', async () => {
      const mockProviderItem = {
        itemId: 'provider_123',
        category: 'llm',
        enabled: true,
      };

      const mockModel = {
        invoke: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            variables: [
              {
                name: 'test_variable',
                value: ['测试值'],
                description: '测试变量描述',
                variableType: 'string',
                source: 'startNode',
              },
            ],
            processedPrompt: '测试{{test_variable}}',
          }),
        }),
      };

      jest
        .spyOn(providerService, 'findDefaultProviderItem')
        .mockResolvedValue(mockProviderItem as any);
      jest.spyOn(providerService, 'prepareChatModel').mockResolvedValue(mockModel as any);

      const mockContext = {
        canvasData: { nodes: [] },
        variables: [],
        contentItems: [],
        analysis: {
          complexity: 0,
          workflowType: '通用工作流',
          primarySkills: ['内容生成'],
          nodeCount: 0,
          variableCount: 0,
          resourceCount: 0,
        },
        extractionContext: {
          lastExtractionTime: undefined,
          recentVariablePatterns: [],
          userWorkflowPreferences: {
            preferredVariableTypes: ['string'],
            commonWorkflowPatterns: ['内容生成'],
            extractionHistory: [],
          },
        },
      };

      const result = await service.performLLMExtraction('测试提示词', mockContext, testUser);

      expect(result).toBeDefined();
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('test_variable');
      expect(result.processedPrompt).toBe('测试{{test_variable}}');
    });

    it('should fallback to basic extraction when LLM fails', async () => {
      jest
        .spyOn(providerService, 'findDefaultProviderItem')
        .mockRejectedValue(new Error('Provider service error'));

      const mockContext = {
        canvasData: { nodes: [] },
        variables: [],
        contentItems: [],
        analysis: {
          complexity: 0,
          workflowType: '通用工作流',
          primarySkills: ['内容生成'],
          nodeCount: 0,
          variableCount: 0,
          resourceCount: 0,
        },
        extractionContext: {
          lastExtractionTime: undefined,
          recentVariablePatterns: [],
          userWorkflowPreferences: {
            preferredVariableTypes: ['string'],
            commonWorkflowPatterns: ['内容生成'],
            extractionHistory: [],
          },
        },
      };

      const result = await service.performLLMExtraction('测试提示词', mockContext, testUser);

      expect(result).toBeDefined();
      expect(result.variables).toHaveLength(0); // Basic extraction returns empty variables for generic workflow
      expect(result.processedPrompt).toBe('测试提示词');
    });
  });

  describe('End-to-End Integration Tests', () => {
    it('should perform complete variable extraction workflow', async () => {
      // Mock all dependencies
      const mockContentItems = [
        {
          id: 'item1',
          type: 'text',
          title: '测试内容项',
          content: '测试内容',
        },
      ];

      const mockProviderItem = {
        itemId: 'provider_123',
        category: 'llm',
        enabled: true,
      };

      const mockModel = {
        invoke: jest.fn().mockResolvedValue({
          content: JSON.stringify({
            variables: [
              {
                name: 'project_name',
                value: [''],
                description: '项目名称',
                variableType: 'string',
                source: 'startNode',
              },
              {
                name: 'time_requirement',
                value: [''],
                description: '时间要求',
                variableType: 'string',
                source: 'startNode',
              },
            ],
            processedPrompt: '帮我创建一个{{project_name}}计划，时间要求是{{time_requirement}}',
          }),
        }),
      };

      jest.spyOn(canvasService, 'getCanvasContentItems').mockResolvedValue(mockContentItems as any);
      jest
        .spyOn(providerService, 'findDefaultProviderItem')
        .mockResolvedValue(mockProviderItem as any);
      jest.spyOn(providerService, 'prepareChatModel').mockResolvedValue(mockModel as any);
      jest.spyOn(prismaService.variableExtractionHistory, 'create').mockResolvedValue({
        pk: BigInt(4),
        sessionId: null,
        canvasId: testCanvasId,
        uid: testUser.uid,
        triggerType: 'askAI_direct',
        extractionMode: 'direct',
        originalPrompt: '帮我创建一个项目计划',
        processedPrompt: '帮我创建一个{{project_name}}计划，时间要求是{{time_requirement}}',
        extractedVariables: JSON.stringify([
          {
            name: 'project_name',
            value: '',
            description: '项目名称',
            variableType: 'string',
            source: 'startNode',
          },
          {
            name: 'time_requirement',
            value: '',
            description: '时间要求',
            variableType: 'string',
            source: 'startNode',
          },
        ]),
        reusedVariables: '[]',
        extractionConfidence: { toNumber: () => 0.9 } as any, // Mock Decimal type
        processingTimeMs: null,
        llmModel: null,
        status: 'applied',
        appliedAt: new Date(),
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await service.extractVariables(
        testUser,
        '帮我创建一个项目计划',
        testCanvasId,
        'direct',
      );

      expect(result).toBeDefined();
      expect(result.variables).toHaveLength(2);
      expect(result.variables[0].name).toBe('project_name');
      expect(result.variables[1].name).toBe('time_requirement');
      expect(result.processedPrompt).toBe(
        '帮我创建一个{{project_name}}计划，时间要求是{{time_requirement}}',
      );
      expect(result.originalPrompt).toBe('帮我创建一个项目计划');
    });

    it('should handle candidate mode with session ID', async () => {
      const mockCandidateRecord = {
        sessionId: testSessionId,
        canvasId: testCanvasId,
        uid: testUser.uid,
        originalPrompt: '生成一份技术报告',
        extractedVariables: [
          {
            name: 'report_topic',
            value: [''],
            description: '报告主题',
            variableType: 'string',
            source: 'startNode',
          },
        ] as WorkflowVariable[],
        reusedVariables: [],
        applied: false,
        expiresAt: new Date(Date.now() + 3600000),
        createdAt: new Date(),
      };

      // Mock the private method directly
      const getCandidateRecordSpy = jest
        .spyOn(service as any, 'getCandidateRecord')
        .mockResolvedValue(mockCandidateRecord);

      const result = await service.extractVariables(
        testUser,
        '生成一份技术报告',
        testCanvasId,
        'direct',
        testSessionId,
      );

      expect(result).toBeDefined();
      expect(result.sessionId).toBe(testSessionId);
      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('report_topic');

      getCandidateRecordSpy.mockRestore();
    });
  });
});
