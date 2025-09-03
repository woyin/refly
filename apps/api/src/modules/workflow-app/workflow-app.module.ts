import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { WorkflowAppController } from './workflow-app.controller';
import { WorkflowAppService } from './workflow-app.service';
import { CanvasModule } from '../canvas/canvas.module';
import { MiscModule } from '../misc/misc.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [CommonModule, CanvasModule, MiscModule, WorkflowModule],
  controllers: [WorkflowAppController],
  providers: [WorkflowAppService],
  exports: [WorkflowAppService],
})
export class WorkflowAppModule {}
