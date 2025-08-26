import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';
import {
  AppTemplateResult,
  VariableExtractionResult,
} from 'src/modules/variable-extraction/variable-extraction.dto';
import { VariableExtractionService } from 'src/modules/variable-extraction/variable-extraction.service';

@Controller('v1/variable-extraction')
export class VariableExtractionController {
  constructor(private readonly variableExtractionService: VariableExtractionService) {}

  /**
   * APP发布模板生成接口
   * 基于Canvas所有原始prompt和变量生成用户意图模板
   */
  @UseGuards(JwtAuthGuard)
  @Post('generate-template')
  async generateAppTemplate(
    @LoginedUser() user: User,
    @Body() body: {
      canvasId: string; // 画布ID
    },
  ): Promise<AppTemplateResult> {
    return this.variableExtractionService.generateAppPublishTemplate(user, body.canvasId);
  }

  /**
   * Unified variable extraction interface
   * Supports two modes: 'direct' (directly update Canvas variables) and 'candidate' (return candidate solutions)
   */
  @UseGuards(JwtAuthGuard)
  @Post('extract')
  async extractVariables(
    @LoginedUser() user: User,
    @Body() body: {
      prompt: string; // Original natural language prompt
      canvasId: string; // Canvas ID, used to get existing variable context
      mode: 'direct' | 'candidate'; // Processing mode
      sessionId?: string; // Optional, check for candidate records when in direct mode
    },
  ): Promise<VariableExtractionResult> {
    return this.variableExtractionService.extractVariables(user, body.prompt, body.canvasId, {
      mode: body.mode,
      sessionId: body.sessionId,
    });
  }
}
