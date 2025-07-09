import { Injectable, Logger } from '@nestjs/common';
import { Tool, Context } from '@rekog/mcp-nest';
import { z } from 'zod';
import { Request } from 'express';
import { InternalMcpService } from '../internal-mcp.service';
import { User as UserModel } from '../../../generated/client';
import { MediaGeneratorService } from '../../media-generator/media-generator.service';
import { ActionService } from '../../action/action.service';
import { ProviderService } from '../../provider/provider.service';
import { MediaGenerateRequest, MediaGenerationModelConfig } from '@refly/openapi-schema';

@Injectable()
export class MediaGeneratorTools {
  private readonly logger = new Logger(MediaGeneratorTools.name);

  // Timeout configurations for different media types (in milliseconds)
  private readonly timeoutConfig = {
    image: 90 * 1000, // 90 seconds for images
    audio: 5 * 60 * 1000, // 5 minutes for audio
    video: 10 * 60 * 1000, // 10 minutes for video
  };

  // Polling interval (in milliseconds)
  private readonly pollInterval = 2000; // 2 seconds

  constructor(
    private readonly mediaGeneratorService: MediaGeneratorService,
    private readonly actionService: ActionService,
    private readonly internalMcpService: InternalMcpService,
    private readonly providerService: ProviderService,
  ) {}

  /**
   * Get user's configured media generation provider and model
   */
  private async getUserMediaConfig(
    user: UserModel,
    mediaType: 'image' | 'audio' | 'video',
  ): Promise<{
    provider: string;
    model?: string;
  }> {
    try {
      // Find user's configured media generation provider items
      const providerItems = await this.providerService.listProviderItems(user, {
        category: 'mediaGeneration',
        enabled: true,
      });

      if (mediaType) {
        // If user has configured media generation provider items
        if (providerItems && providerItems.length > 0) {
          // If mediaType is specified, try to find a model that supports it

          for (const providerItem of providerItems) {
            const config: MediaGenerationModelConfig = JSON.parse(providerItem.config || '{}');

            // Check if this model supports the requested mediaType
            if (config.capabilities?.[mediaType]) {
              this.logger.log(
                `Found user configured ${mediaType} model: ${config.modelId} from provider: ${providerItem.provider?.providerKey}`,
              );

              return {
                provider: providerItem.provider?.providerKey || 'replicate',
                model: config.modelId,
              };
            }
          }
        }
        return this.getDefaultModelForMediaType(mediaType);
      }

      return null;
    } catch (error) {
      this.logger.warn(
        `Failed to get user media config: ${error?.message || error}, using default for ${mediaType}`,
      );
      return null;
    }
  }

  /**
   * Get default model configuration based on mediaType
   */
  private getDefaultModelForMediaType(mediaType?: 'image' | 'audio' | 'video'): {
    provider: string;
    model: string;
  } {
    // Default models based on mediaType and capabilities from media-config.json
    const defaultModels = {
      image: {
        provider: 'replicate',
        model: 'black-forest-labs/flux-dev', // High-quality image generation
      },
      video: {
        provider: 'replicate',
        model: 'bytedance/seedance-1-lite', // Fast video generation
      },
      audio: {
        provider: 'replicate',
        model: 'resemble-ai/chatterbox', // Audio generation
      },
    };

    const defaultConfig = defaultModels[mediaType];

    this.logger.log(
      `Using default ${mediaType || 'image'} model: ${defaultConfig.model} from provider: ${defaultConfig.provider}`,
    );

    return defaultConfig;
  }

  /**
   * Generate media with internal polling mechanism
   */
  @Tool({
    name: 'generate_media',
    description:
      'Generate multimedia content including images, videos, and audio. This tool supports all three media types: "image" for generating pictures and artwork, "video" for creating video clips and animations, and "audio" for generating music, sound effects, and voice content. The tool automatically handles the generation process with real-time progress updates until completion.',
    parameters: z.object({
      mediaType: z
        .enum(['image', 'audio', 'video'])
        .describe(
          'Type of media to generate: "image" for pictures/artwork, "video" for video clips/animations, "audio" for music/sounds/voice',
        ),
      prompt: z.string().describe('Detailed text prompt describing the media content to generate'),
      model: z
        .string()
        .optional()
        .describe(
          'Specific AI model to use for generation (optional - will auto-select based on media type if not provided)',
        ),
      provider: z
        .string()
        .optional()
        .describe('Provider platform to use (optional - defaults to replicate)'),
    }),
  })
  async generateMedia(
    params: {
      mediaType: 'image' | 'audio' | 'video';
      prompt: string;
      model?: string;
      provider?: string;
    },
    context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'generate_media' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      // Get user's configured media generation settings
      const userMediaConfig = await this.getUserMediaConfig(user, params.mediaType);

      // Use provided parameters or fall back to user's configured settings
      const finalProvider = params.provider || userMediaConfig?.provider || 'replicate';
      const finalModel = params.model || userMediaConfig?.model;

      this.logger.log(
        `Using provider: ${finalProvider}, model: ${finalModel || 'default'} for user ${user.uid}`,
      );

      // Build media generation request
      const mediaRequest: MediaGenerateRequest = {
        mediaType: params.mediaType,
        prompt: params.prompt,
        model: finalModel,
        provider: finalProvider,
      };

      // Start media generation
      const generateResponse = await this.mediaGeneratorService.generateMedia(user, mediaRequest);

      if (!generateResponse.success || !generateResponse.resultId) {
        return this.internalMcpService.formatErrorResponse(
          new Error('Failed to start media generation'),
        );
      }

      const { resultId } = generateResponse;

      // Report initial progress
      await context.reportProgress({
        progress: 5,
        total: 100,
      });

      // Start polling with timeout
      const timeout = this.timeoutConfig[params.mediaType];
      const startTime = Date.now();

      this.logger.log(`Starting polling for ${params.mediaType} generation, timeout: ${timeout}ms`);

      while (Date.now() - startTime < timeout) {
        // Wait for polling interval
        await this.sleep(this.pollInterval);

        // Check status
        const actionResult = await this.actionService.getActionResult(user, { resultId });

        // Calculate progress based on elapsed time and media type
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(Math.floor((elapsed / timeout) * 90) + 5, 95);

        // Report progress
        await context.reportProgress({
          progress: estimatedProgress,
          total: 100,
        });

        // Check if completed
        if (actionResult.status === 'finish') {
          // Report completion
          await context.reportProgress({
            progress: 100,
            total: 100,
          });

          this.logger.log(`Media generation completed for ${resultId}`);

          return this.internalMcpService.formatSuccessResponse({
            success: true,
            resultId,
            status: 'completed',
            mediaType: params.mediaType,
            prompt: params.prompt,
            provider: finalProvider,
            model: finalModel,
            outputUrl: actionResult.outputUrl,
            storageKey: actionResult.storageKey,
            elapsedTime: `${Math.round((Date.now() - startTime) / 1000)}s`,
          });
        }

        // Check if failed
        if (actionResult.status === 'failed') {
          const errors = actionResult.errors || [];
          this.logger.error(`Media generation failed for ${resultId}: ${JSON.stringify(errors)}`);

          const errorMessage = Array.isArray(errors) ? errors.join(', ') : String(errors);
          return this.internalMcpService.formatErrorResponse(
            new Error(`Media generation failed: ${errorMessage}`),
          );
        }

        // Continue polling if still executing or waiting
        this.logger.debug(`Media generation status for ${resultId}: ${actionResult.status}`);
      }

      // Timeout reached
      this.logger.warn(`Media generation timeout for ${resultId} after ${timeout}ms`);

      return this.internalMcpService.formatErrorResponse(
        Object.assign(new Error(`Media generation timeout after ${timeout / 1000}s`), {
          resultId,
          suggestion: `Use get_media_generation_status with resultId "${resultId}" to check status later`,
        }),
      );
    } catch (error) {
      this.logger.error(`Error in generate_media: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }

  /**
   * Get media generation status (for backward compatibility)
   */
  @Tool({
    name: 'get_media_generation_status',
    description:
      'Check the current status and progress of any media generation task (image, video, or audio) using its result ID. This tool can be used to monitor long-running generation tasks.',
    parameters: z.object({
      resultId: z
        .string()
        .describe('The unique result ID returned from a previous media generation request'),
    }),
  })
  async getMediaGenerationStatus(
    params: { resultId: string },
    _context: Context,
    request: Request,
  ) {
    try {
      const user = request.user as UserModel;

      if (!user?.uid) {
        this.logger.error('User not found in request, MCP tool authentication may have failed');
        return {
          content: [{ type: 'text', text: 'Error: User authentication failed' }],
        };
      }

      this.logger.log(
        `Tool 'get_media_generation_status' called by user ${user.uid}, params: ${JSON.stringify(params)}`,
      );

      const actionResult = await this.actionService.getActionResult(user, {
        resultId: params.resultId,
      });

      const response = {
        resultId: params.resultId,
        status: actionResult.status,
        title: actionResult.title,
        outputUrl: actionResult.outputUrl,
        storageKey: actionResult.storageKey,
        errors: actionResult.errors || [],
        createdAt: actionResult.createdAt,
        updatedAt: actionResult.updatedAt,
      };

      return this.internalMcpService.formatSuccessResponse(response);
    } catch (error) {
      this.logger.error(`Error in get_media_generation_status: ${error?.message || error}`);
      return this.internalMcpService.formatErrorResponse(error);
    }
  }

  /**
   * Helper method to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
