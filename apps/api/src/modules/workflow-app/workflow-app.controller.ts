import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Query,
  DefaultValuePipe,
  ParseIntPipe,
} from '@nestjs/common';
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
  ListWorkflowAppsResponse,
  ListOrder,
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
    const executionId = await this.workflowAppService.executeWorkflowApp(
      user,
      request.shareId, // Changed from request.appId to request.shareId
      request.variables,
    );

    return buildSuccessResponse({ executionId });
  }

  @UseGuards(JwtAuthGuard)
  @Get('list')
  async listWorkflowApps(
    @LoginedUser() user: UserModel,
    @Query('canvasId') canvasId: string,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(10), ParseIntPipe) pageSize: number,
    @Query('order', new DefaultValuePipe('creationDesc')) order: ListOrder,
    @Query('keyword') keyword: string,
  ): Promise<ListWorkflowAppsResponse> {
    const workflowApps = await this.workflowAppService.listWorkflowApps(user, {
      canvasId,
      page,
      pageSize,
      order,
      keyword,
    });
    return buildSuccessResponse(workflowApps);
  }
}
