import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { ToolCallService } from './tool-call.service';

@Module({
  imports: [CommonModule],
  providers: [ToolCallService],
  exports: [ToolCallService],
})
export class ToolCallModule {}
