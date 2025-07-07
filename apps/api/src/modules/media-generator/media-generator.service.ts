import { Injectable } from '@nestjs/common';
import { User, MediaGenerateRequest, MediaGenerateResponse } from '@refly/openapi-schema';
import {
  ReplicateAudioGenerator,
  ReplicateVideoGenerator,
  ReplicateImageGenerator,
} from '@refly/providers';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';

import { genActionResultID } from '@refly/utils';

@Injectable()
export class MediaGeneratorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
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
    try {
      // Update status to Executing
      await this.prisma.actionResult.update({
        where: { resultId_version: { resultId, version: 0 } },
        data: { status: 'executing' },
      });

      const provider = request.provider || 'replicate';

      if (provider === 'replicate') {
        const result = await this.generateWithReplicate(request);

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
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
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

  private async generateWithReplicate(request: MediaGenerateRequest): Promise<{ output: string }> {
    let result: { output: string };

    switch (request.mediaType) {
      case 'audio':
        result = await this.generateAudioWithReplicate(request);
        break;
      case 'video':
        result = await this.generateVideoWithReplicate(request);
        break;
      case 'image':
        result = await this.generateImageWithReplicate(request);
        break;
      default:
        throw new Error(`Unsupported media type: ${request.mediaType}`);
    }

    return result;
  }

  private async generateAudioWithReplicate(
    request: MediaGenerateRequest,
  ): Promise<{ output: string }> {
    const generator = new ReplicateAudioGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
    });
  }

  private async generateVideoWithReplicate(
    request: MediaGenerateRequest,
  ): Promise<{ output: string }> {
    const generator = new ReplicateVideoGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
    });
  }

  private async generateImageWithReplicate(
    request: MediaGenerateRequest,
  ): Promise<{ output: string }> {
    const generator = new ReplicateImageGenerator();

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
    });
  }
}
