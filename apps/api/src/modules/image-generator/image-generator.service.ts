import { Injectable } from '@nestjs/common';
import { ImageGeneratorRequest, ImageGeneratorResponse } from './image-generator.dto';
import { ReplicateImageGenerator } from '@refly/providers';

/**
 * 图片生成服务
 */
@Injectable()
export class ImageGeneratorService {
  /**
   * 生成图片
   * @param request 图片生成请求
   * @returns 图片生成响应
   */
  async generateImage(request: ImageGeneratorRequest): Promise<ImageGeneratorResponse> {
    try {
      if (request.provider === 'replicate') {
        return await this.generateWithReplicate(request);
      }
      throw new Error(`Unsupported provider: ${request.provider}`);
    } catch (error) {
      console.error('Image generation failed:', error);
      throw error;
    }
  }

  /**
   * 使用 Replicate 生成图片
   * @param request 请求参数
   * @returns 生成结果
   */
  private async generateWithReplicate(
    request: ImageGeneratorRequest,
  ): Promise<ImageGeneratorResponse> {
    const generator = new ReplicateImageGenerator();

    const result = await generator.generate({
      apiKey: request.apiKey,
      model: request.model,
      prompt: request.prompt,
      aspectRatio: request.aspectRatio,
    });

    return {
      output: result.output,
    };
  }
}
