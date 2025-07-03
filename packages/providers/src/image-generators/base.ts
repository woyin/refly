/**
 * 图片生成请求接口
 */
export interface ImageGenerationRequest {
  prompt: string;
  model: string;
  aspectRatio?: string;
  apiKey: string;
}

/**
 * 图片生成响应接口
 */
export interface ImageGenerationResponse {
  output: string;
}

/**
 * 图片生成器基础抽象类
 */
export abstract class BaseImageGenerator {
  /**
   * 生成图片
   * @param request 生成请求
   * @returns 生成响应
   */
  abstract generate(request: ImageGenerationRequest): Promise<ImageGenerationResponse>;
}
