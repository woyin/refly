import { Injectable } from '@nestjs/common';
import { ImageGeneratorRequest, ImageGeneratorResponse } from './image-generator.dto';
import { ReplicateImageGenerator } from '@refly/providers';

@Injectable()
export class ImageGeneratorService {
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
