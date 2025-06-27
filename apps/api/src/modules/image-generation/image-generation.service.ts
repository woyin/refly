import { Injectable, BadRequestException } from '@nestjs/common';
import { getImageGenerator } from '@refly/providers';
import { ImageGenerationTestRequest, GenerationResponse } from './image-generation.dto';

type ImageProvider = 'replicate' | 'fal';

@Injectable()
export class ImageGenerationService {
  async generateImage(dto: ImageGenerationTestRequest): Promise<GenerationResponse> {
    try {
      // Configure the provider
      const providerConfig = {
        providerKey: dto.provider,
        model: dto.model,
        apiKey: dto.apiKey || this.getDefaultApiKey(dto.provider),
        // Set reasonable defaults for async providers like Replicate
        pollInterval: dto.provider === 'replicate' ? 3000 : undefined,
        maxPollAttempts: dto.provider === 'replicate' ? 100 : undefined,
      };

      // Get the generator
      const generator = getImageGenerator(providerConfig);

      // Prepare the generation request
      const request = {
        prompt: dto.prompt,
        negativePrompt: dto.negativePrompt,
        width: dto.width || 1024,
        height: dto.height || 1024,
        steps: dto.steps,
        guidance: dto.guidance,
        seed: dto.seed,
        count: dto.count || 1,
      };

      // Generate the image
      const result = await generator.generate(request);

      // Transform the response to match our DTO
      return {
        images: result.outputs.map((output) => ({
          url: output.url || '',
          width: output.width || dto.width || 1024,
          height: output.height || dto.height || 1024,
          format: output.format,
          seed: output.seed,
        })),
        metadata: result.metadata,
      };
    } catch (error) {
      console.error('Image generation error:', error);
      throw new BadRequestException(`Image generation failed: ${error.message}`);
    }
  }

  private getDefaultApiKey(provider: ImageProvider): string {
    // In production, these should come from environment variables
    switch (provider) {
      case 'replicate':
        return process.env.REPLICATE_API_KEY || 'test-replicate-key';
      case 'fal':
        return process.env.FAL_API_KEY || 'test-fal-key';
      default:
        throw new BadRequestException(`Unsupported provider: ${provider}`);
    }
  }

  // Utility method to get available models for each provider
  getAvailableModels(provider: ImageProvider): string[] {
    switch (provider) {
      case 'replicate':
        return [
          'stability-ai/stable-diffusion-xl-base-1.0',
          'stability-ai/stable-diffusion-3-medium',
          'black-forest-labs/flux-schnell',
          'black-forest-labs/flux-dev',
        ];
      case 'fal':
        return ['flux/schnell', 'flux/dev', 'stable-diffusion-xl', 'stable-diffusion-3'];
      default:
        return [];
    }
  }
}
