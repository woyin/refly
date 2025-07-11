import { Injectable } from '@nestjs/common';
import { User, MediaGenerateRequest, MediaGenerateResponse } from '@refly/openapi-schema';
import {
  ReplicateAudioGenerator,
  ReplicateVideoGenerator,
  ReplicateImageGenerator,
  FalAudioGenerator,
  FalVideoGenerator,
  FalImageGenerator,
  VolcesVideoGenerator,
  VolcesImageGenerator,
} from '@refly/providers';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { ProviderService } from '../provider/provider.service';
import { genActionResultID } from '@refly/utils';

@Injectable()
export class MediaGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Start asynchronous media generation task
   * @param user User Information
   * @param request Media Generation Request
   * @returns Response containing resultId
   */
  async generateMedia(user: User, request: MediaGenerateRequest): Promise<MediaGenerateResponse> {
    try {
      const resultId = genActionResultID();

      // Creating an ActionResult Record
      await this.prisma.actionResult.create({
        data: {
          resultId,
          uid: user.uid,
          type: 'media',
          title: `${request.mediaType} generation: ${request.prompt.substring(0, 50)}...`,
          status: 'waiting',
          input: JSON.stringify(request),
          version: 0,
        },
      });

      // Perform media generation asynchronously
      this.executeMediaGeneration(user, resultId, request).catch((error) => {
        console.error(`Media generation failed for ${resultId}:`, error);
      });

      return {
        success: true,
        resultId,
      };
    } catch (error) {
      console.error('Media generation initialization failed:', error);
      return {
        success: false,
      };
    }
  }

  /**
   * Execute media generation tasks
   * @param resultId Result ID
   * @param request Media Generation Request
   */
  private async executeMediaGeneration(
    user: User,
    resultId: string,
    request: MediaGenerateRequest,
  ): Promise<void> {
    let result: { output: string };
    try {
      // Update status to Executing
      await this.prisma.actionResult.update({
        where: { resultId_version: { resultId, version: 0 } },
        data: { status: 'executing' },
      });

      const providerKey = request.provider;

      const provider = await this.providerService.findProvider(user, {
        category: 'mediaGeneration',
        providerKey: providerKey,
        enabled: true,
      });

      if (!provider) {
        throw new Error('No media generation provider found');
      }

      if (providerKey === 'replicate') {
        result = await this.generateWithReplicate(user, request, provider.apiKey);
      } else if (providerKey === 'fal') {
        result = await this.generateWithFal(user, request, provider.apiKey);
      } else if (providerKey === 'volces') {
        result = await this.generateWithVolces(user, request, provider.apiKey);
      } else {
        throw new Error(`Unsupported provider: ${providerKey}`);
      }

      const uploadResult = await this.miscService.dumpFileFromURL(user, {
        url: result.output,
        entityId: resultId, //ActionResult
        entityType: 'mediaResult',
        visibility: 'private',
      });

      // The update status is completed, saving the storage information inside the system
      await this.prisma.actionResult.update({
        where: { resultId_version: { resultId, version: 0 } },
        data: {
          status: 'finish',
          outputUrl: uploadResult.url, // Using system internal URL
          storageKey: uploadResult.storageKey, // Save storage key
        },
      });
    } catch (error) {
      console.error(`Media generation execution failed for ${resultId}:`, error);

      // Update status is failed
      await this.prisma.actionResult.update({
        where: { resultId_version: { resultId, version: 0 } },
        data: {
          status: 'failed',
          errors: JSON.stringify([error.message || 'Media generation failed']),
        },
      });
    }
  }

  private async generateWithReplicate(
    _user: User,
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    let result: { output: string };

    switch (request.mediaType) {
      case 'audio':
        result = await this.generateAudioWithReplicate(request, apiKey);
        break;
      case 'video':
        result = await this.generateVideoWithReplicate(request, apiKey);
        break;
      case 'image':
        result = await this.generateImageWithReplicate(request, apiKey);
        break;
      default:
        throw new Error(`Unsupported media type: ${request.mediaType}`);
    }

    return result;
  }

  private async generateWithFal(
    _user: User,
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    let result: { output: string };

    switch (request.mediaType) {
      case 'audio':
        result = await this.generateAudioWithFal(request, apiKey);
        break;
      case 'video':
        result = await this.generateVideoWithFal(request, apiKey);
        break;
      case 'image':
        result = await this.generateImageWithFal(request, apiKey);
        break;
      default:
        throw new Error(`Unsupported media type: ${request.mediaType}`);
    }
    return result;
  }

  private async generateWithVolces(
    _user: User,
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    let result: { output: string };

    switch (request.mediaType) {
      case 'video':
        result = await this.generateVideoWithVolces(request, apiKey);
        break;
      case 'image':
        result = await this.generateImageWithVolces(request, apiKey);
        break;
      default:
        throw new Error(`Unsupported media type: ${request.mediaType}`);
    }
    return result;
  }

  private async generateAudioWithReplicate(
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    const generator = new ReplicateAudioGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
      apiKey: apiKey,
    });
  }

  private async generateVideoWithReplicate(
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    const generator = new ReplicateVideoGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
      apiKey: apiKey,
    });
  }

  private async generateImageWithReplicate(
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    const generator = new ReplicateImageGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
      apiKey: apiKey,
    });
  }

  private async generateAudioWithFal(
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    const generator = new FalAudioGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
      apiKey: apiKey,
    });
  }

  private async generateVideoWithFal(
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    const generator = new FalVideoGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
      apiKey: apiKey,
    });
  }

  private async generateImageWithFal(
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    const generator = new FalImageGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
      apiKey: apiKey,
    });
  }

  private async generateVideoWithVolces(
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    const generator = new VolcesVideoGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
      apiKey: apiKey,
    });
  }

  private async generateImageWithVolces(
    request: MediaGenerateRequest,
    apiKey: string,
  ): Promise<{ output: string }> {
    const generator = new VolcesImageGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
      apiKey: apiKey,
    });
  }
}
