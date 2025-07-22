import { Injectable } from '@nestjs/common';
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
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';
import { ProviderService } from '../provider/provider.service';
import { PromptProcessorService } from './prompt-processor.service';
import { genActionResultID } from '@refly/utils';

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
    private readonly providerService: ProviderService,
    private readonly promptProcessor: PromptProcessorService,
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
      // ===== Language Processing: Detect and translate prompt =====
      const promptProcessingResult = await this.promptProcessor.processPrompt(request.prompt);

      // Update status to Executing with language processing info
      await this.prisma.actionResult.update({
        where: { resultId_version: { resultId, version: 0 } },
        data: {
          status: 'executing',
          // Store language processing info while keeping original request intact
          input: JSON.stringify({
            ...request, // Keep original request fields unchanged (prompt = original user input)
            // Add new fields for language processing
            englishPrompt: promptProcessingResult.translatedPrompt, // English version for generation
            detectedLanguage: promptProcessingResult.detectedLanguage,
            isTranslated: promptProcessingResult.isTranslated,
          }),
        },
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

      // Create request with translated prompt for third-party service
      const _translatedRequest: MediaGenerateRequest = {
        ...request,
        prompt: promptProcessingResult.translatedPrompt, // Use English prompt for generation
      };

      result = await this.generateWithProvider(request, provider.apiKey);

      const uploadResult = await this.miscService.dumpFileFromURL(user, {
        url: result.output,
        entityId: resultId, //ActionResult
        entityType: 'mediaResult',
        visibility: 'private',
      });

      const providerItem = await this.providerService.findMediaProviderItemByModelID(
        user,
        request.model,
      );

      const _creditBilling: CreditBilling = providerItem?.creditBilling
        ? JSON.parse(providerItem?.creditBilling)
        : undefined;

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
      console.error(`Media generation failed for ${resultId}:`, error);

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
    apiKey: string,
  ): Promise<{ output: string }> {
    const { provider, mediaType, model, prompt } = request;

    // Get the generator factory from configuration
    const providerConfig = this.generatorConfig[provider];
    if (!providerConfig) {
      throw new Error(`Unsupported provider: ${provider}`);
    }

    const generatorFactory = providerConfig[mediaType];
    if (!generatorFactory) {
      throw new Error(`Unsupported media type '${mediaType}' for provider '${provider}'`);
    }

    // Create generator instance and generate media
    const generator = generatorFactory();
    return await generator.generate({
      model,
      prompt,
      apiKey,
    });
  }
}
