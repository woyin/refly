import { Injectable } from '@nestjs/common';
import { User, MediaGenerateRequest, MediaGenerateResponse } from '@refly/openapi-schema';
import {
  ReplicateAudioGenerator,
  ReplicateVideoGenerator,
  ReplicateImageGenerator,
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
   * 启动异步媒体生成任务
   * @param user 用户信息
   * @param request 媒体生成请求
   * @returns 包含resultId的响应
   */
  async generateMedia(user: User, request: MediaGenerateRequest): Promise<MediaGenerateResponse> {
    try {
      const resultId = genActionResultID();

      // 创建 ActionResult 记录
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

      // 异步执行媒体生成
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
   * 执行媒体生成任务
   * @param resultId 结果ID
   * @param request 媒体生成请求
   */
  private async executeMediaGeneration(
    user: User,
    resultId: string,
    request: MediaGenerateRequest,
  ): Promise<void> {
    try {
      // 更新状态为执行中
      await this.prisma.actionResult.update({
        where: { resultId_version: { resultId, version: 0 } },
        data: { status: 'executing' },
      });

      const provider = request.provider || 'replicate';

      if (provider === 'replicate') {
        const result = await this.generateWithReplicate(user, request);

        const uploadResult = await this.miscService.dumpFileFromURL(user, {
          url: result.output,
          entityId: resultId, //ActionResult
          entityType: 'mediaResult',
          visibility: 'private',
        });

        // 更新状态为完成，保存系统内部的存储信息
        await this.prisma.actionResult.update({
          where: { resultId_version: { resultId, version: 0 } },
          data: {
            status: 'finish',
            outputUrl: uploadResult.url, // 使用系统内部URL
            storageKey: uploadResult.storageKey, // 保存存储键
          },
        });
      } else {
        throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`Media generation execution failed for ${resultId}:`, error);

      // 更新状态为失败
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
    user: User,
    request: MediaGenerateRequest,
  ): Promise<{ output: string }> {
    let result: { output: string };

    switch (request.mediaType) {
      case 'audio':
        result = await this.generateAudioWithReplicate(request);
        break;
      case 'video':
        result = await this.generateVideoWithReplicate(request);
        break;
      case 'image':
        result = await this.generateImageWithReplicate(request, user);
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
    user: User,
  ): Promise<{ output: string }> {
    const generator = new ReplicateImageGenerator();

    const provider = await this.providerService.findProvider(user, {
      category: 'mediaGeneration',
      providerKey: request.provider,
      enabled: true,
    });

    if (!provider) {
      throw new Error('No media generation provider found');
    }

    if (provider.providerKey !== request.provider) {
      throw new Error(`Unsupported media generation provider: ${provider.providerKey}`);
    }

    return await generator.generate({
      model: request.model,
      prompt: request.prompt,
      apiKey: provider.apiKey,
    });
  }
}
