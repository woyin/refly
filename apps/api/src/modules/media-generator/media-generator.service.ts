import { Injectable } from '@nestjs/common';
import { MediaGenerateRequest, MediaGenerateResponse, MediaType } from './media-generator.dto';
import {
  ReplicateAudioGenerator,
  ReplicateVideoGenerator,
  ReplicateImageGenerator,
} from '@refly/providers';

@Injectable()
export class MediaGeneratorService {
  async generateMedia(request: MediaGenerateRequest): Promise<MediaGenerateResponse> {
    try {
      const provider = request.provider || 'replicate';

      if (provider === 'replicate') {
        return await this.generateWithReplicate(request);
      }

      throw new Error(`Unsupported provider: ${provider}`);
    } catch (error) {
      console.error('Media generation failed:', error);
      return {
        success: false,
        message: error.message || 'Media generation failed',
      };
    }
  }

  private async generateWithReplicate(
    request: MediaGenerateRequest,
  ): Promise<MediaGenerateResponse> {
    let result: { output: string };

    switch (request.mediaType) {
      case MediaType.AUDIO:
        result = await this.generateAudioWithReplicate(request);
        break;
      case MediaType.VIDEO:
        result = await this.generateVideoWithReplicate(request);
        break;
      case MediaType.IMAGE:
        result = await this.generateImageWithReplicate(request);
        break;
      default:
        throw new Error(`Unsupported media type: ${request.mediaType}`);
    }

    return {
      success: true,
      data: {
        outputUrl: result.output,
      },
    };
  }

  private async generateAudioWithReplicate(
    request: MediaGenerateRequest,
  ): Promise<{ output: string }> {
    const generator = new ReplicateAudioGenerator();

    return await generator.generate({
      apiKey: request.apiKey,
      model: request.model,
      prompt: request.prompt,
    });
  }

  private async generateVideoWithReplicate(
    request: MediaGenerateRequest,
  ): Promise<{ output: string }> {
    const generator = new ReplicateVideoGenerator();

    return await generator.generate({
      apiKey: request.apiKey,
      model: request.model,
      prompt: request.prompt,
    });
  }

  private async generateImageWithReplicate(
    request: MediaGenerateRequest,
  ): Promise<{ output: string }> {
    const generator = new ReplicateImageGenerator();

    return await generator.generate({
      apiKey: request.apiKey,
      model: request.model,
      prompt: request.prompt,
    });
  }
}
