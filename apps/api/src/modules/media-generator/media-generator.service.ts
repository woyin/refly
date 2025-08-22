import { Injectable, Logger } from '@nestjs/common';
import {
  User,
  MediaGenerateRequest,
  MediaGenerateResponse,
  CreditBilling,
} from '@refly/openapi-schema';
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
import { ModelUsageQuotaExceeded, ProviderItemNotFoundError } from '@refly/errors';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_SYNC_MEDIA_CREDIT_USAGE } from '../../utils/const';
import { SyncMediaCreditUsageJobData } from '../subscription/subscription.dto';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { CreditService } from '../credit/credit.service';
import { ProviderService } from '../provider/provider.service';
import { PromptProcessorService } from './prompt-processor.service';
import { genActionResultID, pick } from '@refly/utils';
import { fal } from '@fal-ai/client';
import Replicate from 'replicate';

// Define generator interface for type safety
interface MediaGenerator {
  generate(params: { model: string; prompt: string; apiKey: string }): Promise<{ output: string }>;
}

// Generator factory type
type GeneratorFactory = () => MediaGenerator;

// Generator mapping configuration
type GeneratorConfig = {
  [provider: string]: {
    [mediaType: string]: GeneratorFactory;
  };
};

@Injectable()
export class MediaGeneratorService {
  private readonly logger = new Logger(MediaGeneratorService.name);

  // Generator configuration mapping
  private readonly generatorConfig: GeneratorConfig = {
    replicate: {
      audio: () => new ReplicateAudioGenerator(),
      video: () => new ReplicateVideoGenerator(),
      image: () => new ReplicateImageGenerator(),
    },
    fal: {
      audio: () => new FalAudioGenerator(),
      video: () => new FalVideoGenerator(),
      image: () => new FalImageGenerator(),
    },
    volces: {
      video: () => new VolcesVideoGenerator(),
      image: () => new VolcesImageGenerator(),
    },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly miscService: MiscService,
    private readonly credit: CreditService,
    private readonly providerService: ProviderService,
    private readonly promptProcessor: PromptProcessorService,
    @InjectQueue(QUEUE_SYNC_MEDIA_CREDIT_USAGE)
    private readonly mediaCreditUsageReportQueue: Queue<SyncMediaCreditUsageJobData>,
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

      const { mediaType, model, prompt, targetType, targetId, providerItemId } = request;

      // Creating an ActionResult Record
      await this.prisma.actionResult.create({
        data: {
          resultId,
          uid: user.uid,
          type: 'media',
          title: `${mediaType} generation: ${prompt.substring(0, 50)}...`,
          modelName: model,
          targetType,
          targetId,
          providerItemId,
          status: 'waiting',
          input: JSON.stringify(request),
          version: 0,
        },
      });

      // Perform media generation asynchronously
      this.executeMediaGeneration(user, resultId, request).catch((error) => {
        this.logger.error(`Media generation failed for ${resultId}:`, error);
      });

      return {
        success: true,
        resultId,
      };
    } catch (error) {
      this.logger.error('Media generation initialization failed:', error);
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
    const { providerItemId, prompt } = request;

    try {
      // ===== Language Processing: Detect and translate prompt =====
      const promptProcessingResult = await this.promptProcessor.processPrompt(prompt);

      // Update status to Executing with language processing info
      await this.prisma.actionResult.update({
        where: { resultId_version: { resultId, version: 0 } },
        data: {
          status: 'executing',
          // Store language processing info while keeping original request intact
          input: JSON.stringify({
            ...pick(request, ['mediaType', 'model', 'prompt']), // Keep original request fields unchanged (prompt = original user input)
            // Add new fields for language processing
            englishPrompt: promptProcessingResult.translatedPrompt, // English version for generation
            detectedLanguage: promptProcessingResult.detectedLanguage,
            isTranslated: promptProcessingResult.isTranslated,
          }),
        },
      });

      const providerItem = await this.providerService.findProviderItemById(user, providerItemId);

      if (!providerItem) {
        throw new ProviderItemNotFoundError(`provider item ${providerItemId} not found`);
      }

      const creditBilling: CreditBilling = providerItem?.creditBilling
        ? JSON.parse(providerItem?.creditBilling)
        : undefined;

      if (creditBilling) {
        const creditUsageResult = await this.credit.checkRequestCreditUsage(user, creditBilling);
        this.logger.log('creditUsageResult', creditUsageResult);
        if (!creditUsageResult.canUse) {
          throw new ModelUsageQuotaExceeded(`credit not available: ${creditUsageResult.message}`);
        }
      }

      // Create request with translated prompt for third-party service
      const translatedRequest: MediaGenerateRequest = {
        ...request,
        prompt: promptProcessingResult.translatedPrompt, // Use English prompt for generation
      };

      result = await this.generateWithProvider(translatedRequest, providerItem.provider);

      const uploadResult = await this.miscService.dumpFileFromURL(user, {
        url: result.output,
        entityId: resultId,
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

      if (this.mediaCreditUsageReportQueue && creditBilling) {
        const basicUsageData = {
          uid: user.uid,
          resultId,
        };
        const mediaCreditUsage: SyncMediaCreditUsageJobData = {
          ...basicUsageData,
          creditBilling,
          timestamp: new Date(),
        };

        await this.mediaCreditUsageReportQueue.add(
          `media_credit_usage_report:${resultId}`,
          mediaCreditUsage,
        );
      }
    } catch (error) {
      this.logger.error(`Media generation failed for ${resultId}: ${error.stack}`);

      // Update status to failed
      await this.prisma.actionResult.update({
        where: { resultId_version: { resultId, version: 0 } },
        data: {
          status: 'failed',
          errors: JSON.stringify([error instanceof Error ? error.message : 'Unknown error']),
        },
      });
    }
  }

  /**
   * Generate media using the appropriate provider and media type
   * @param request Media generation request
   * @param apiKey API key for the provider
   * @returns Generated media output
   */
  private async generateWithProvider(
    request: MediaGenerateRequest,
    provider: { apiKey: string; providerKey: string },
  ): Promise<{ output: string }> {
    const { mediaType, model, prompt } = request;
    const { apiKey, providerKey } = provider;

    // Get the generator factory from configuration
    const providerConfig = this.generatorConfig[providerKey];
    if (!providerConfig) {
      throw new Error(
        `Unsupported provider for media generation: ${providerKey}, provider item id: ${request.providerItemId}`,
      );
    }

    const generatorFactory = providerConfig[mediaType];
    if (!generatorFactory) {
      throw new Error(`Unsupported media type '${mediaType}' for provider '${providerKey}'`);
    }

    // Create generator instance and generate media
    const generator = generatorFactory();
    return await generator.generate({
      model,
      prompt,
      apiKey,
    });
  }

  async generate(user: User, request: MediaGenerateRequest): Promise<MediaGenerateResponse> {
    const resultId = request.resultId || genActionResultID();

    await this.prisma.actionResult.create({
      data: {
        resultId,
        uid: user.uid,
        type: 'media',
        title: `${request.mediaType} generation: ${request.prompt.substring(0, 50)}...`,
        modelName: request.model,
        targetType: request.targetType,
        targetId: request.targetId,
        providerItemId: request.providerItemId,
        status: 'executing',
        input: JSON.stringify(request),
        version: 0,
      },
    });

    const providerItem = await this.providerService.findProviderItemById(
      user,
      request.providerItemId,
    );

    if (!providerItem) {
      throw new ProviderItemNotFoundError(`provider item ${request.providerItemId} not found`);
    }

    const creditBilling: CreditBilling = providerItem?.creditBilling
      ? JSON.parse(providerItem?.creditBilling)
      : undefined;

    if (creditBilling) {
      const creditUsageResult = await this.credit.checkRequestCreditUsage(user, creditBilling);
      this.logger.log('creditUsageResult', creditUsageResult);
      if (!creditUsageResult.canUse) {
        throw new ModelUsageQuotaExceeded(`credit not available: ${creditUsageResult.message}`);
      }
    }

    const input = this.buildInputObject(request);
    let url = '';

    // Generate media based on provider type
    const providerKey = providerItem?.provider?.providerKey;

    if (providerKey === 'replicate') {
      // Use Replicate provider
      const replicate = new Replicate({
        auth: providerItem?.provider?.apiKey ?? '',
      });

      const output = await replicate.run(
        request.model as `${string}/${string}` | `${string}/${string}:${string}`,
        { input },
      );

      url = this.getUrlFromReplicateOutput(output);
    } else if (providerKey === 'fal') {
      // Use Fal provider
      fal.config({
        credentials: providerItem.provider.apiKey,
      });

      const result = await fal.subscribe(request.model, {
        input: input,
        logs: true,
        onQueueUpdate: (update) => {
          if (update.status === 'IN_PROGRESS') {
            update.logs?.map((log) => log.message).forEach(console.log);
          }
        },
      });

      url = this.getUrlFromFalResult(result);
    } else {
      throw new Error(`Unsupported provider: ${providerKey}`);
    }

    const uploadResult = await this.miscService.dumpFileFromURL(user, {
      url: url,
      entityId: resultId,
      entityType: 'mediaResult',
      visibility: 'private',
    });

    await this.prisma.actionResult.update({
      where: { resultId_version: { resultId, version: 0 } },
      data: {
        status: 'finish',
        outputUrl: uploadResult.url, // Using system internal URL
        storageKey: uploadResult.storageKey, // Save storage key
      },
    });

    if (this.mediaCreditUsageReportQueue && creditBilling) {
      const basicUsageData = {
        uid: user.uid,
        resultId,
      };
      const mediaCreditUsage: SyncMediaCreditUsageJobData = {
        ...basicUsageData,
        creditBilling,
        timestamp: new Date(),
      };

      await this.mediaCreditUsageReportQueue.add(
        `media_credit_usage_report:${resultId}`,
        mediaCreditUsage,
      );
    }

    return {
      success: true,
      resultId,
      outputUrl: uploadResult.url,
      storageKey: uploadResult.storageKey,
    };
  }

  private buildInputObject(request: MediaGenerateRequest): Record<string, any> {
    if (!request?.inputParameters) {
      return {
        prompt: request?.prompt ?? '', // Base field
      };
    }

    const input: Record<string, any> = {};
    if (Array.isArray(request?.inputParameters)) {
      for (const param of request.inputParameters) {
        if (param?.name && param?.value !== undefined) {
          input[param.name] = param.value;
        }
      }
    }

    return input;
  }

  private getUrlFromReplicateOutput(output: any): string {
    // Check for model_file property
    if (output?.model_file ?? false) {
      return output.model_file;
    }
    // Check for wav property
    if (output?.wav ?? false) {
      return output.wav;
    }
    // Check for mesh_paint property
    if (output?.mesh_paint ?? false) {
      return output.mesh_paint;
    }
    // Check if output is an array and return the first element if exists
    if (Array.isArray(output) && output?.[0] !== undefined) {
      return output[0];
    }
    // Fallback: return output as string (or empty string if undefined)
    return output ?? '';
  }

  private getUrlFromFalResult(result: any): string {
    if (result?.audio?.url) return result.audio.url;
    if (result?.video?.url) return result.video.url;
    if (result?.image?.url) return result.image.url;
    if (result?.model_glb?.url) return result.image.url;
    if (result?.model_mesh?.url) return result.image.url;

    if (result?.audios?.[0]?.url) return result.audios[0].url;
    if (result?.videos?.[0]?.url) return result.videos[0].url;
    if (result?.images?.[0]?.url) return result.images[0].url;

    return '';
  }
}
