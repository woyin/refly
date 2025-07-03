import { BaseAsyncVideoGenerator } from './base';
import { GenerationRequest, GenerationResponse, VideoGenerationProvider } from '../types';

export interface ReplicateVideoConfig extends VideoGenerationProvider {
  providerKey: 'replicate';
  model: string;
  apiKey: string;
  baseUrl?: string;
}

/**
 * Replicate视频生成器
 * 实现基于Replicate平台的视频生成功能
 */
export class ReplicateVideoGenerator extends BaseAsyncVideoGenerator {
  protected config: ReplicateVideoConfig;
  private baseUrl: string;

  constructor(config: ReplicateVideoConfig) {
    super(config);
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.replicate.com';
  }

  /**
   * 提交视频生成任务
   * @param request 生成请求
   * @returns 任务ID
   */
  protected async submitTask(request: GenerationRequest): Promise<string> {
    const input = this.transformInput(request);

    const response = await fetch(`${this.baseUrl}/v1/predictions`, {
      method: 'POST',
      headers: {
        Authorization: `Token ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        version: this.config.model,
        input,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Replicate API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const prediction = await response.json();
    return prediction.id;
  }

  /**
   * 检查任务状态
   * @param taskId 任务ID
   * @returns 任务状态信息
   */
  protected async checkTaskStatus(taskId: string): Promise<{
    status: 'pending' | 'processing' | 'succeeded' | 'failed';
    result?: any;
    error?: string;
  }> {
    const response = await fetch(`${this.baseUrl}/v1/predictions/${taskId}`, {
      headers: {
        Authorization: `Token ${this.config.apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to check task status: ${response.status}`);
    }

    const prediction = await response.json();

    return {
      status: prediction.status,
      result: prediction.status === 'succeeded' ? prediction : undefined,
      error: prediction.error,
    };
  }

  /**
   * 转换输入参数
   * @param request 生成请求
   * @returns 转换后的输入参数
   */
  protected transformInput(request: GenerationRequest): any {
    const input: any = {
      prompt: request.prompt,
      width: request.width || 1024,
      height: request.height || 576,
      num_inference_steps: request.steps || 25,
      guidance_scale: request.guidance || 7.5,
      fps: request.fps || 24,
    };

    // 视频时长（秒）
    if (request.duration) {
      input.duration = request.duration;
    }

    // 负面提示词
    if (request.negativePrompt) {
      input.negative_prompt = request.negativePrompt;
    }

    // 随机种子
    if (request.seed !== undefined) {
      input.seed = request.seed;
    }

    // 输入图像（用于图像到视频）
    if (request.inputImage) {
      input.image = request.inputImage;
    }

    // 宽高比
    if (request.aspectRatio) {
      input.aspect_ratio = request.aspectRatio;
    }

    return input;
  }

  /**
   * 转换输出格式
   * @param result 原始结果
   * @param request 原始请求
   * @param taskId 任务ID
   * @returns 标准化的生成响应
   */
  protected transformOutput(
    result: any,
    request: GenerationRequest,
    taskId: string,
  ): GenerationResponse {
    const videos = Array.isArray(result.output) ? result.output : [result.output];

    return {
      outputs: videos.filter(Boolean).map((url: string) => ({
        url,
        width: request.width || 1024,
        height: request.height || 576,
        duration: request.duration || 5,
        format: 'mp4',
      })),
      metadata: {
        prompt: request.prompt,
        model: this.config.model,
        provider: 'replicate',
        parameters: result.input,
        usage: {
          cost: result.metrics?.predict_time ? result.metrics.predict_time * 0.002 : undefined, // 视频生成成本更高
          processingTime: result.metrics?.predict_time,
        },
        taskId,
      },
    };
  }

  /**
   * 批量生成视频
   * @param requests 生成请求数组
   * @returns 生成响应数组
   */
  async generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]> {
    // 并发处理多个请求
    return Promise.all(requests.map((request) => this.generate(request)));
  }
}
