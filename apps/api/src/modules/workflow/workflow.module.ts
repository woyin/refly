import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CommonModule } from '../common/common.module';
import { CanvasModule } from '../canvas/canvas.module';
import { CanvasSyncModule } from '../canvas-sync/canvas-sync.module';
import { SkillModule } from '../skill/skill.module';
import { WorkflowService } from './workflow.service';
import { WorkflowVariableService } from './workflow-variable.service';
import { KnowledgeModule } from '../knowledge/knowledge.module';
import { WorkflowController } from './workflow.controller';
import { SyncWorkflowProcessor, RunWorkflowProcessor } from './workflow.processor';
import { QUEUE_SYNC_WORKFLOW, QUEUE_RUN_WORKFLOW } from '../../utils/const';
import { isDesktop } from '../../utils/runtime';

@Module({
  imports: [
    CommonModule,
    CanvasModule,
    CanvasSyncModule,
    SkillModule,
    KnowledgeModule,
    ...(isDesktop()
      ? []
      : [
          BullModule.registerQueue({ name: QUEUE_SYNC_WORKFLOW }),
          BullModule.registerQueue({ name: QUEUE_RUN_WORKFLOW }),
        ]),
  ],
  controllers: [WorkflowController],
  providers: [
    WorkflowService,
    WorkflowVariableService,
    ...(isDesktop() ? [] : [SyncWorkflowProcessor, RunWorkflowProcessor]),
  ],
  exports: [WorkflowService, WorkflowVariableService],
})
export class WorkflowModule {}
