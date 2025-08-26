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

  // Timeout configurations for different media types (in milliseconds)
  private readonly timeoutConfig = {
    image: 90 * 1000, // 90 seconds for images
    audio: 5 * 60 * 1000, // 5 minutes for audio
    video: 10 * 60 * 1000, // 10 minutes for video
  };

  // Polling interval (in milliseconds)
  private readonly pollInterval = 2000; // 2 seconds

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
   * Validate that the provided model and providerItemId are compatible with the requested media type
   * @param user User information
   * @param mediaType Media type (image, audio, video)
   * @param model Model ID
   * @param providerItemId Provider item ID
   * @returns Validation result
   */
  private async validateMediaGenerationRequest(
    user: User,
    mediaType: string,
    model: string,
    providerItemId: string,
  ): Promise<{ isValid: boolean; error?: string }> {
    try {
      // Get the provider item to validate
      const providerItem = await this.providerService.findProviderItemById(user, providerItemId);

      if (!providerItem) {
        return {
          isValid: false,
          error: `Provider item ${providerItemId} not found`,
        };
      }

      // Check if the provider item supports the requested media type
      try {
        const config: any = JSON.parse(providerItem.config || '{}');
        const capabilities = config.capabilities || {};

        if (!capabilities[mediaType]) {
          return {
            isValid: false,
            error: `Provider item ${providerItem.itemId} does not support ${mediaType} generation`,
          };
        }

        // Check if the model ID matches
        if (config.modelId !== model) {
          return {
            isValid: false,
            error: `Model ID mismatch: requested ${model}, but provider item has ${config.modelId}`,
          };
        }

        return { isValid: true };
      } catch (parseError) {
        return {
          isValid: false,
          error: `Invalid provider item configuration: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`,
        };
      }
    } catch (error) {
      return {
        isValid: false,
        error: `Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Get user's default media generation model configuration
   * @param user User information
   * @param mediaType Media type (image, audio, video)
   * @returns Default model configuration or null if not configured
   */
  private async getUserDefaultMediaModel(
    user: User,
    mediaType: string,
  ): Promise<{ model: string; providerItemId: string } | null> {
    try {
      // Get user's configured media generation settings
      const userMediaConfig = await this.providerService.getUserMediaConfig(
        user,
        mediaType as 'image' | 'audio' | 'video',
      );

      if (!userMediaConfig) {
        this.logger.warn(
          `No media generation model configured for ${mediaType} for user ${user.uid}`,
        );
        return null;
      }

      this.logger.log(
        `Using user's default ${mediaType} model: ${userMediaConfig.model} from provider: ${userMediaConfig.provider}`,
      );

      return {
        model: userMediaConfig.model,
        providerItemId: userMediaConfig.providerItemId,
      };
    } catch (error) {
      this.logger.warn(
        `Failed to get user's default media model for ${mediaType}: ${error?.message || error}`,
      );
      return null;
    }
  }

  /**
   * Start asynchronous media generation task
   * @param user User Information
   * @param request Media Generation Request
   * @returns Response containing resultId or completed result if wait is true
   */
  async generateMedia(user: User, request: MediaGenerateRequest): Promise<MediaGenerateResponse> {
    try {
      const resultId = genActionResultID();

      const { mediaType, model, prompt, targetType, targetId, providerItemId, wait } = request;

      // If no model or providerItemId is specified, try to get user's default configuration
      let finalModel = model;
      let finalProviderItemId = providerItemId;

      if (!finalModel || !finalProviderItemId) {
        this.logger.log(
          `No model or providerItemId specified for ${mediaType} generation, using user's default configuration`,
        );
        const defaultConfig = await this.getUserDefaultMediaModel(user, mediaType);
        if (defaultConfig) {
          finalModel = finalModel ?? defaultConfig.model;
          finalProviderItemId = finalProviderItemId ?? defaultConfig.providerItemId;
          this.logger.log(
            `Using default ${mediaType} model: ${finalModel} with providerItemId: ${finalProviderItemId}`,
          );
        } else {
          this.logger.warn(`No default ${mediaType} model configured for user ${user.uid}`);
          return {
            success: false,
            errMsg: `No media generation model configured for ${mediaType}. Please configure a model first using the settings.`,
          };
        }
      } else {
        this.logger.log(
          `Using specified ${mediaType} model: ${finalModel} with providerItemId: ${finalProviderItemId}`,
        );
      }

      // Validate the final model and providerItemId
      this.logger.log(`Validating ${mediaType} generation request for user ${user.uid}`);
      const validation = await this.validateMediaGenerationRequest(
        user,
        mediaType,
        finalModel,
        finalProviderItemId,
      );
      if (!validation.isValid) {
        this.logger.warn(`Media generation validation failed: ${validation.error}`);
        return {
          success: false,
          errMsg: validation.error || 'Invalid media generation configuration',
        };
      }
      this.logger.log(`Media generation request validation passed for user ${user.uid}`);

      // Creating an ActionResult Record
      await this.prisma.actionResult.create({
        data: {
          resultId,
          uid: user.uid,
          type: 'media',
          title: `${mediaType} generation: ${prompt.substring(0, 50)}...`,
          modelName: finalModel,
          targetType,
          targetId,
          providerItemId: finalProviderItemId,
          status: 'waiting',
          input: JSON.stringify({
            ...request,
            model: finalModel,
            providerItemId: finalProviderItemId,
          }),
          version: 0,
        },
      });

      // Create the final request with resolved model and providerItemId
      const finalRequest: MediaGenerateRequest = {
        ...request,
        model: finalModel,
        providerItemId: finalProviderItemId,
      };

      // Start media generation asynchronously
      this.executeMediaGeneration(user, resultId, finalRequest).catch((error) => {
        this.logger.error(`Media generation failed for ${resultId}:`, error);
      });

      // If wait is true, execute synchronously and return result
      if (wait) {
        // Poll for completion
        try {
          const result = await this.pollActionResult(resultId, mediaType);
          return {
            success: true,
            resultId,
            outputUrl: result.outputUrl,
            storageKey: result.storageKey,
          };
        } catch (error) {
          this.logger.error(`Synchronous media generation failed for ${resultId}:`, error);
          return {
            success: false,
            errMsg: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }

      return {
        success: true,
        resultId,
      };
    } catch (error) {
      this.logger.error('Media generation initialization failed:', error);
      return {
        success: false,
        errMsg: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Execute media generation tasks
   * @param user User Information
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

  /**
   * Helper method to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Poll for action result completion with timeout
   * @param resultId Result ID to poll
   * @param mediaType Media type for timeout calculation
   * @returns Action result when completed
   */
  private async pollActionResult(
    resultId: string,
    mediaType: string,
  ): Promise<{ outputUrl: string; storageKey: string }> {
    const timeout =
      this.timeoutConfig[mediaType as keyof typeof this.timeoutConfig] ?? this.timeoutConfig.image;
    const startTime = Date.now();

    this.logger.log(`Starting polling for ${mediaType} generation, timeout: ${timeout}ms`);

    while (Date.now() - startTime < timeout) {
      // Wait for polling interval
      await this.sleep(this.pollInterval);

      // Check status
      const actionResult = await this.prisma.actionResult.findFirst({
        where: { resultId },
        orderBy: { version: 'desc' },
      });

      if (!actionResult) {
        throw new Error(`ActionResult not found for resultId: ${resultId}`);
      }

      // Check if completed
      if (actionResult.status === 'finish') {
        if (!actionResult.outputUrl || !actionResult.storageKey) {
          throw new Error('Media generation completed but output data is missing');
        }

        this.logger.log(`Media generation completed for ${resultId}`);
        return {
          outputUrl: actionResult.outputUrl,
          storageKey: actionResult.storageKey,
        };
      }

      // Check if failed
      if (actionResult.status === 'failed') {
        const errors = actionResult.errors ? JSON.parse(actionResult.errors) : [];
        const errorMessage = Array.isArray(errors) ? errors.join(', ') : String(errors);
        throw new Error(`Media generation failed: ${errorMessage}`);
      }

      // Continue polling if still executing or waiting
      this.logger.debug(`Media generation status for ${resultId}: ${actionResult.status}`);
    }

    // Timeout reached
    throw new Error(`Media generation timeout after ${timeout / 1000}s`);
  }
}
