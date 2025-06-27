import { BaseAsyncGenerator } from './base';
import { GenerationRequest, GenerationResponse, ImageGenerationProvider } from '../types';

export interface ReplicateImageConfig extends ImageGenerationProvider {
  providerKey: 'replicate';
  model: string;
  apiKey: string;
  baseUrl?: string;
}

export class ReplicateImageGenerator extends BaseAsyncGenerator {
  protected config: ReplicateImageConfig;
  private baseUrl: string;

  constructor(config: ReplicateImageConfig) {
    super(config);
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://api.replicate.com';
  }

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

  protected transformInput(request: GenerationRequest): any {
    const input: any = {
      prompt: request.prompt,
      width: request.width || 1024,
      height: request.height || 1024,
      num_inference_steps: request.steps || 50,
      guidance_scale: request.guidance || 7.5,
      num_outputs: request.count || 1,
    };

    if (request.negativePrompt) {
      input.negative_prompt = request.negativePrompt;
    }

    if (request.seed !== undefined) {
      input.seed = request.seed;
    }

    if (request.inputImage) {
      input.image = request.inputImage;
    }

    return input;
  }

  protected transformOutput(
    result: any,
    request: GenerationRequest,
    taskId: string,
  ): GenerationResponse {
    const images = Array.isArray(result.output) ? result.output : [result.output];

    return {
      outputs: images.filter(Boolean).map((url: string) => ({
        url,
        width: request.width || 1024,
        height: request.height || 1024,
        format: 'png',
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

  async generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]> {
    // 并发处理多个请求
    return Promise.all(requests.map((request) => this.generate(request)));
  }
}
