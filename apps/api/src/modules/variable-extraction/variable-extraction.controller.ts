import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guard/jwt-auth.guard';
import { LoginedUser } from '../../utils/decorators/user.decorator';
import { User } from '@refly/openapi-schema';
import { VariableExtractionResult } from 'src/modules/variable-extraction/variable-extraction.dto';
import { VariableExtractionService } from 'src/modules/variable-extraction/variable-extraction.service';

@Controller('v1/variable-extraction')
export class VariableExtractionController {
  constructor(private readonly variableExtractionService: VariableExtractionService) {}

  /**
   * 统一的变量提取接口
   * 支持 'direct'（直接更新Canvas变量）和 'candidate'（返回候选方案）两种模式
   */
  @UseGuards(JwtAuthGuard)
  @Post('extract')
  async extractVariables(
    @LoginedUser() user: User,
    @Body() body: {
      prompt: string; // 原始自然语言提示
      canvasId: string; // 画布ID，用于获取现有变量上下文
      mode: 'direct' | 'candidate'; // 处理模式
      sessionId?: string; // 可选，直接模式时检查是否有候选记录
    },
  ): Promise<VariableExtractionResult> {
    return this.variableExtractionService.extractVariables(user, body.prompt, body.canvasId, {
      mode: body.mode,
      sessionId: body.sessionId,
    });
  }
}
