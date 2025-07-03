import { BaseSyncVideoGenerator } from './base';
import { GenerationRequest, GenerationResponse, VideoGenerationProvider } from '../types';

export interface FALVideoConfig extends VideoGenerationProvider {
  providerKey: 'fal';
  model: string;
  apiKey: string;
  baseUrl?: string;
}

/**
 * FAL视频生成器
 * 实现基于FAL平台的视频生成功能
 */
export class FALVideoGenerator extends BaseSyncVideoGenerator {
  protected config: FALVideoConfig;
  private baseUrl: string;

  constructor(config: FALVideoConfig) {
    super(config);
    this.config = config;
    this.baseUrl = config.baseUrl || 'https://fal.run';
  }

  /**
   * 生成视频
   * @param request 生成请求
   * @returns 生成响应
   */
  async generate(request: GenerationRequest): Promise<GenerationResponse> {
    this.validateRequest(request);

    const input = this.transformInput(request);
    const endpoint = this.getEndpoint();

    // 创建 AbortController 用于超时控制
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000); // 5分钟超时

    try {
      const response = await fetch(`${this.baseUrl}/fal-ai/${endpoint}`, {
        method: 'POST',
        headers: {
          Authorization: `Key ${this.config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();

        // 提供更详细的错误信息和解决建议
        if (response.status === 401) {
          throw new Error(
            `FAL API 认证失败 (401): 无法访问模型 '${this.config.model}'。请检查：1) API密钥是否正确 2) 账户是否有访问该模型的权限 3) 是否需要升级账户。错误详情: ${errorText}`,
          );
        } else if (response.status === 422) {
          throw new Error(`FAL API 参数错误 (422): 请求参数不符合要求。错误详情: ${errorText}`);
        } else if (response.status === 429) {
          throw new Error(
            `FAL API 请求限制 (429): 请求过于频繁，请稍后重试。错误详情: ${errorText}`,
          );
        }

        throw new Error(`FAL API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const result = await response.json();
      return this.transformOutput(result, request);
    } catch (error: any) {
      clearTimeout(timeoutId);

      // 处理不同类型的错误
      if (error.name === 'AbortError') {
        throw new Error(
          'FAL API 请求超时 (5分钟): 视频生成时间过长，请稍后重试或选择较短的视频时长。',
        );
      } else if (error.code === 'UND_ERR_HEADERS_TIMEOUT') {
        throw new Error('FAL API 连接超时: 网络连接不稳定，请检查网络连接后重试。');
      } else if (error.message?.includes('fetch failed')) {
        throw new Error('FAL API 网络错误: 无法连接到 FAL 服务器，请检查网络连接或稍后重试。');
      }

      // 重新抛出其他错误
      throw error;
    }
  }

  /**
   * 批量生成视频
   * @param requests 生成请求数组
   * @returns 生成响应数组
   */
  async generateBatch(requests: GenerationRequest[]): Promise<GenerationResponse[]> {
    // FAL支持批处理，但为了简单起见，我们将进行并行的单独请求
    return Promise.all(requests.map((request) => this.generate(request)));
  }

  /**
   * 获取API端点
   * @returns API端点路径
   */
  private getEndpoint(): string {
    // 将模型映射到FAL端点
    const modelMap: Record<string, string> = {
      veo3: 'veo3',
      'kling-video': 'kling-video/v2/master/text-to-video',
      'minimax-video': 'minimax/hailuo-02/standard/text-to-video',
    };

    // 如果模型是完整的FAL模型ID，直接使用
    if (this.config.model.includes('/')) {
      return this.config.model;
    }

    // 否则，尝试映射
    return modelMap[this.config.model] || this.config.model;
  }

  /**
   * 转换输入参数
   * @param request 生成请求
   * @returns 转换后的输入参数
   */
  private transformInput(request: GenerationRequest): any {
    const input: any = {
      prompt: request.prompt,
      video_size: this.getVideoSize(request),
      num_inference_steps: request.steps || 25,
      guidance_scale: request.guidance || 7.5,
      fps: request.fps || 24,
      enable_safety_checker: true,
    };

    // 视频时长 - 根据不同模型适配不同的格式要求
    if (request.duration) {
      input.duration = this.formatDuration(request.duration);
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
      input.image_url = request.inputImage;
    }

    return input;
  }

  /**
   * 根据模型格式化视频时长参数
   * @param duration 原始时长（秒）
   * @returns 格式化后的时长参数
   */
  private formatDuration(duration: number): string | number {
    const endpoint = this.getEndpoint();

    // 根据不同的模型端点使用不同的格式
    const numericDurationModels = [
      'kling-video/v2/master/text-to-video',
      'minimax/hailuo-02/standard/text-to-video',
    ];

    // 检查是否是需要纯数字格式的模型
    const needsNumericFormat = numericDurationModels.some(
      (model) => endpoint.includes(model) || this.config.model.includes(model),
    );

    if (needsNumericFormat) {
      if (endpoint.includes('kling-video')) {
        return duration <= 7.5 ? 5 : 10;
      } else if (endpoint.includes('minimax')) {
        return duration <= 8 ? 6 : 10;
      } else if (endpoint.includes('veo3')) {
        return '8s';
      }
      return duration;
    } else {
      return `${duration}s`;
    }
  }

  /**
   * 获取视频尺寸
   * @param request 生成请求
   * @returns 视频尺寸字符串
   */
  private getVideoSize(request: GenerationRequest): string {
    const width = request.width || 1024;
    const height = request.height || 576;

    // FAL通常使用预定义的尺寸
    if (request.aspectRatio) {
      const ratioMap: Record<string, string> = {
        '16:9': 'landscape_16_9',
        '9:16': 'portrait_9_16',
        '4:3': 'landscape_4_3',
        '3:4': 'portrait_3_4',
        '1:1': 'square',
      };
      return ratioMap[request.aspectRatio] || 'landscape_16_9';
    }

    // 根据宽高比判断
    const aspectRatio = width / height;
    if (aspectRatio > 1.5) {
      return 'landscape_16_9';
    } else if (aspectRatio < 0.8) {
      return 'portrait_9_16';
    } else {
      return 'square';
    }
  }

  /**
   * 转换输出格式
   * @param result 原始结果
   * @param request 原始请求
   * @returns 标准化的生成响应
   */
  private transformOutput(result: any, request: GenerationRequest): GenerationResponse {
    // FAL根据模型返回不同格式的视频
    let videos: any[] = [];

    if (result.video?.url) {
      videos = [result.video];
    } else if (result.videos && Array.isArray(result.videos)) {
      videos = result.videos;
    } else if (result.url) {
      videos = [{ url: result.url }];
    }

    if (videos.length === 0) {
      throw new Error('No videos generated by FAL');
    }

    return {
      outputs: videos.map((video: any) => ({
        url: video.url,
        width: video.width || request.width || 1024,
        height: video.height || request.height || 576,
        duration: video.duration || request.duration || 5,
        format: 'mp4',
        seed: result.seed,
      })),
      metadata: {
        prompt: request.prompt,
        model: this.config.model,
        provider: 'fal',
        parameters: request,
        usage: {
          processingTime: result.inference_time,
        },
      },
    };
  }
}
