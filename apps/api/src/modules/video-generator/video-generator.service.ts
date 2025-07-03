import { Injectable } from '@nestjs/common';
import { VideoGeneratorRequest, VideoGeneratorResponse } from './video-generator.dto';
import { ReplicateVideoGenerator } from '@refly/providers';

@Injectable()
export class VideoGeneratorService {
  async generateVideo(request: VideoGeneratorRequest): Promise<VideoGeneratorResponse> {
    try {
      if (request.provider === 'replicate') {
        return await this.generateWithReplicate(request);
      }
      throw new Error(`Unsupported provider: ${request.provider}`);
    } catch (error) {
      console.error('Video generation failed:', error);
      throw error;
    }
  }

  private async generateWithReplicate(
    request: VideoGeneratorRequest,
  ): Promise<VideoGeneratorResponse> {
    const generator = new ReplicateVideoGenerator();

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
