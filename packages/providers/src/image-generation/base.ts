import { MultimodalProvider, GenerationRequest, GenerationResponse } from '../types';

// 基础抽象类
export abstract class BaseMultimodalGenerator {
  protected config: MultimodalProvider;

  constructor(config: MultimodalProvider) {
    this.config = config;
  }

  abstract generate(request: GenerationRequest): Promise<GenerationResponse>;
  abstract generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]>;

  protected validateRequest(request: GenerationRequest): void {
    if (!request.prompt || request.prompt.trim().length === 0) {
      throw new Error('Prompt is required for generation');
    }
  }
}

// 同步 Provider 基类
export abstract class BaseSyncGenerator extends BaseMultimodalGenerator {
  // 子类直接实现 generate 方法，调用具体的 API
}

// 异步任务 Provider 基类
export abstract class BaseAsyncGenerator extends BaseMultimodalGenerator {
  // 提交异步任务
  protected abstract submitTask(request: GenerationRequest): Promise<string>;

  // 检查任务状态
  protected abstract checkTaskStatus(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'succeeded' | 'failed';
    result?: any;
    error?: string;
  }>;

  // 轮询任务完成
  protected async pollTaskCompletion(taskId: string): Promise<any> {
    const pollInterval = this.config.pollInterval || 5000;
    const maxAttempts = this.config.maxPollAttempts || 60;
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

  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    this.validateRequest(request);

    const taskId = await this.submitTask(request);
    const result = await this.pollTaskCompletion(taskId);

    return this.transformOutput(result, request, taskId);
  }

  protected abstract transformOutput(
    result: any,
    request: GenerationRequest,
    taskId: string,
  ): GenerationResponse;
}
