import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { CanvasController } from './canvas.controller';
import { CanvasService } from './canvas.service';
import {
  ClearCanvasEntityProcessor,
  SyncCanvasEntityProcessor,
  AutoNameCanvasProcessor,
  PostDeleteCanvasProcessor,
} from './canvas.processor';
import { CollabModule } from '@/collab/collab.module';
import { QUEUE_DELETE_KNOWLEDGE_ENTITY, QUEUE_POST_DELETE_CANVAS } from '@/utils/const';
import { CommonModule } from '@/common/common.module';
import { MiscModule } from '@/misc/misc.module';
import { SubscriptionModule } from '@/subscription/subscription.module';
import { KnowledgeModule } from '@/knowledge/knowledge.module';
import { ActionModule } from '@/action/action.module';
import { CodeArtifactModule } from '@/code-artifact/code-artifact.module';

@Module({
  imports: [
    CommonModule,
    CollabModule,
    MiscModule,
    KnowledgeModule,
    ActionModule,
    CodeArtifactModule,
    SubscriptionModule,
    BullModule.registerQueue({
      name: QUEUE_DELETE_KNOWLEDGE_ENTITY,
    }),
    BullModule.registerQueue({
      name: QUEUE_POST_DELETE_CANVAS,
    }),
  ],
  controllers: [CanvasController],
  providers: [
    CanvasService,
    SyncCanvasEntityProcessor,
    ClearCanvasEntityProcessor,
    AutoNameCanvasProcessor,
    PostDeleteCanvasProcessor,
  ],
  exports: [CanvasService],
})
export class CanvasModule {}
