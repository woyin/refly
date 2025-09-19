import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { WorkflowAppController } from './workflow-app.controller';
import { WorkflowAppService } from './workflow-app.service';
import { CanvasModule } from '../canvas/canvas.module';
import { MiscModule } from '../misc/misc.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { ShareModule } from '../share/share.module';

@Module({
  imports: [CommonModule, CanvasModule, MiscModule, WorkflowModule, ShareModule],
  controllers: [WorkflowAppController],
  providers: [WorkflowAppService],
  exports: [WorkflowAppService],
})
export class WorkflowAppModule {}
