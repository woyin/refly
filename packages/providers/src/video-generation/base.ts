import { MultimodalProvider, GenerationRequest, GenerationResponse } from '../types';

/**
 * 视频生成基础抽象类
 * 定义所有视频生成器的通用接口
 */
export abstract class BaseVideoGenerator {
  protected config: MultimodalProvider;

  constructor(config: MultimodalProvider) {
    this.config = config;
  }

  /**
   * 生成单个视频
   * @param request 生成请求
   * @returns 生成响应
   */
  abstract generate(request: GenerationRequest): Promise<GenerationResponse>;

  /**
   * 批量生成视频
   * @param requests 生成请求数组
   * @returns 生成响应数组
   */
  abstract generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]>;

  /**
   * 验证请求参数
   * @param request 生成请求
   */
  protected validateRequest(request: GenerationRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Prompt is required for video generation');
    }
  }
}

/**
 * 同步视频生成器基类
 * 用于实时返回结果的提供商
 */
export abstract class BaseSyncVideoGenerator extends BaseVideoGenerator {
  // 子类直接实现 generate 方法，调用具体的 API
}

/**
 * 异步视频生成器基类
 * 用于需要轮询任务状态的提供商
 */
export abstract class BaseAsyncVideoGenerator extends BaseVideoGenerator {
  /**
   * 提交异步任务
   * @param request 生成请求
   * @returns 任务ID
   */
  protected abstract submitTask(request: GenerationRequest): Promise<string>;

  /**
   * 检查任务状态
   * @param taskId 任务ID
   * @returns 任务状态信息
   */
  protected abstract checkTaskStatus(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'succeeded' | 'failed';
    result?: any;
    error?: string;
  }>;

  /**
   * 轮询任务完成
   * @param taskId 任务ID
   * @returns 任务结果
   */
  protected async pollTaskCompletion(taskId: string): Promise<any> {
    const pollInterval = this.config.pollInterval || 5000;
    const maxAttempts = this.config.maxPollAttempts || 120; // 视频生成需要更长时间
    let attempts = 0;

    while (attempts < maxAttempts) {
      const status = await this.checkTaskStatus(taskId);

      if (status.status === 'succeeded') {
        return status.result;
      } else if (status.status === 'failed') {
        throw new Error(`Task failed: ${status.error}`);
      }

      await new Promise((resolve) => setTimeout(resolve, pollInterval));
      attempts++;
    }

    throw new Error(`Task ${taskId} timed out after ${maxAttempts} attempts`);
  }

  /**
   * 生成视频（异步实现）
   * @param request 生成请求
   * @returns 生成响应
   */
  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    this.validateRequest(request);

    const taskId = await this.submitTask(request);
    const result = await this.pollTaskCompletion(taskId);

    return this.transformOutput(result, request, taskId);
  }

  /**
   * 转换输出格式
   * @param result 原始结果
   * @param request 原始请求
   * @param taskId 任务ID
   * @returns 标准化的生成响应
   */
  protected abstract transformOutput(
    result: any,
    request: GenerationRequest,
    taskId: string,
  ): GenerationResponse;
}
