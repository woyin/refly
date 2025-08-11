import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '../../generated/client';
import { WorkflowService } from './workflow.service';
import { InitializeWorkflowRequest, InitializeWorkflowResponse } from './workflow.dto';

@Controller('v1/workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @UseGuards(JwtAuthGuard)
  @Post('initialize')
  async initializeWorkflow(
    @LoginedUser() user: UserModel,
    @Body() request: InitializeWorkflowRequest,
  ): Promise<InitializeWorkflowResponse> {
    const executionId = await this.workflowService.initializeWorkflowExecution(
      user,
      request.canvasId,
    );

    return {
      executionId,
      success: true,
    };
  }
}
