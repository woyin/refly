import { Controller, Post, Body, UseGuards, Get, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User as UserModel } from '../../generated/client';
import { WorkflowAppService } from './workflow-app.service';
import {
  CreateWorkflowAppRequest,
  CreateWorkflowAppResponse,
  GetWorkflowAppDetailResponse,
  ExecuteWorkflowAppRequest,
  ExecuteWorkflowAppResponse,
} from '@refly/openapi-schema';
import { buildSuccessResponse } from '../../utils';

@Controller('v1/workflow-app')
export class WorkflowAppController {
  constructor(private readonly workflowAppService: WorkflowAppService) {}

  @UseGuards(JwtAuthGuard)
  @Post('new')
  async createWorkflowApp(
    @LoginedUser() user: UserModel,
    @Body() request: CreateWorkflowAppRequest,
  ): Promise<CreateWorkflowAppResponse> {
    const workflowApp = await this.workflowAppService.createWorkflowApp(user, request);
    return buildSuccessResponse(workflowApp);
  }

  @UseGuards(JwtAuthGuard)
  @Get('detail')
  async getWorkflowAppDetail(
    @LoginedUser() user: UserModel,
    @Query('appId') appId: string,
  ): Promise<GetWorkflowAppDetailResponse> {
    const workflowApp = await this.workflowAppService.getWorkflowAppDetail(user, appId);
    return buildSuccessResponse(workflowApp);
  }

  @UseGuards(JwtAuthGuard)
  @Post('execute')
  async executeWorkflowApp(
    @LoginedUser() user: UserModel,
    @Body() request: ExecuteWorkflowAppRequest,
  ): Promise<ExecuteWorkflowAppResponse> {
    // MIGRATION: Accept shareId instead of appId for unified workflow app access
    // This aligns with the frontend's direct static file access pattern
    const executionId = await this.workflowAppService.executeWorkflowApp(
      user,
      request.shareId, // Changed from request.appId to request.shareId
      request.variables,
    );

    return buildSuccessResponse({ executionId });
  }
}
