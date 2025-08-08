import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { SkillModule } from '../skill/skill.module';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { ProviderModule } from '../provider/provider.module';
import { CodeArtifactModule } from '../code-artifact/code-artifact.module';
import { PilotService } from './pilot.service';
import { PilotController } from './pilot.controller';
import { RunPilotProcessor, SyncPilotStepProcessor } from './pilot.processor';
import { DivergentEngine } from './divergent-engine';
import { DivergentOrchestrator } from './divergent-orchestrator';
import { PilotDivergentService } from './pilot-divergent.service';
import { ProviderService } from '../provider/provider.service';
import { QUEUE_RUN_PILOT } from '../../utils/const';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    SkillModule,
    ProviderModule,
    KnowledgeModule,
    CodeArtifactModule,
    BullModule.registerQueue({
      name: QUEUE_RUN_PILOT,
    }),
  ],
  controllers: [PilotController],
  providers: [
    PilotService,
    RunPilotProcessor,
    SyncPilotStepProcessor,
    DivergentEngine,
    DivergentOrchestrator,
    PilotDivergentService,
    {
      provide: 'CHAT_MODEL',
      useFactory: async (providerService: ProviderService) => {
        try {
          // For testing purposes, try to use a default system user or create a mock user
          // In production, this would need proper user context
          const mockUser = { uid: 'system-pilot', username: 'system' };

          // Try to get available LLM provider items for system user
          const providerItems = await providerService.findProviderItemsByCategory(
            mockUser as any,
            'llm',
          );
          if (providerItems && providerItems.length > 0) {
            const firstItem = providerItems[0];
            const config = JSON.parse(firstItem.config || '{}');
            return await providerService.prepareChatModel(mockUser as any, config.modelId);
          }

          throw new Error('No LLM provider available');
        } catch (error) {
          // If no default model is available, create a basic mock that logs the issue
          console.warn('No default chat model available, using mock for divergent mode:', error);
          return {
            invoke: async (prompt: string) => {
              console.log(`Mock LLM Call - Prompt: ${prompt.substring(0, 200)}...`);
              return {
                content: JSON.stringify({
                  tasks: [
                    {
                      name: 'Research AI trends',
                      skillName: 'webSearch',
                      parameters: { query: 'AI trends 2024' },
                    },
                    {
                      name: 'Analyze data',
                      skillName: 'commonQnA',
                      parameters: { query: 'analyze AI development' },
                    },
                  ],
                }),
              };
            },
          };
        }
      },
      inject: [ProviderService],
    },
  ],
  exports: [PilotService, PilotDivergentService],
})
export class PilotModule {}
