import { BaseAsyncAudioGenerator } from './base';
import { GenerationRequest, GenerationResponse, AudioGenerationProvider } from '../types';

export interface ReplicateAudioConfig extends AudioGenerationProvider {
  providerKey: 'replicate';
  model: string;
  apiKey: string;
  baseUrl?: string;
}

/**
 * Replicate音频生成器
 * 实现基于Replicate API的异步音频生成功能
 */
export class ReplicateAudioGenerator extends BaseAsyncAudioGenerator {
  protected config: ReplicateAudioConfig;
  private baseUrl: string;

  constructor(config: ReplicateAudioConfig) {
    super(config);
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.replicate.com';
  }

  /**
   * 提交异步音频生成任务
   * @param request 生成请求参数
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
        `Replicate Audio API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const prediction = await response.json();
    return prediction.id;
  }

  /**
   * 检查异步任务状态
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
      throw new Error(`Failed to check audio generation task status: ${response.status}`);
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
   * @param request 生成请求参数
   * @returns Replicate API输入格式
   */
  protected transformInput(request: GenerationRequest): any {
    const input: any = {};

    // 根据模型添加特定参数
    if (this.config.model.includes('musicgen')) {
      input.prompt = request.prompt;
      input.duration = request.duration || 10;
      input.num_outputs = request.count || 1;
      input.model_version = 'large';
      input.normalization_strategy = 'loudness';
      input.top_k = 250;
      input.top_p = 0.0;
    } else if (this.config.model.includes('bark')) {
      input.text = request.prompt;
      input.voice_preset = 'v2/en_speaker_6';
      input.duration = request.duration || 10;
      input.num_outputs = request.count || 1;
    } else if (this.config.model.includes('speech')) {
      // Minimax speech models use specific parameter format
      input.text = request.prompt;
      input.emotion = 'neutral';
      input.voice_id = 'Deep_Voice_Man';
      input.language_boost = 'English';
      input.english_normalization = true;
    } else {
      // 默认格式
      input.prompt = request.prompt;
      input.duration = request.duration || 10;
      input.num_outputs = request.count || 1;
    }

    if (request.seed !== undefined) {
      input.seed = request.seed;
    }

    if (request.inputAudio) {
      input.input_audio = request.inputAudio;
    }

    return input;
  }

  /**
   * 转换输出格式
   * @param result Replicate API响应
   * @param request 原始请求
   * @param taskId 任务ID
   * @returns 标准化的生成响应
   */
  protected transformOutput(
    result: any,
    request: GenerationRequest,
    taskId: string,
  ): GenerationResponse {
    const audios = Array.isArray(result.output) ? result.output : [result.output];

    return {
      outputs: audios.filter(Boolean).map((url: string) => ({
        url,
        duration: request.duration || 10,
        format: 'wav',
      })),
      metadata: {
        prompt: request.prompt,
        model: this.config.model,
        provider: 'replicate',
        parameters: result.input,
        usage: {
          cost: result.metrics?.predict_time ? result.metrics.predict_time * 0.001 : undefined,
          processingTime: result.metrics?.predict_time,
        },
        taskId,
      },
    };
  }

  /**
   * 批量生成音频
   * @param requests 生成请求参数数组
   * @returns 生成响应数组
   */
  async generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]> {
    // 并发处理多个请求
    return Promise.all(requests.map((request) => this.generate(request)));
  }
}
