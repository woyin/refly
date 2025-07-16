import { z } from 'zod';
import { BaseSkill, BaseSkillState, SkillRunnableConfig, baseStateGraphArgs } from '../base';
import {
  Icon,
  SkillInvocationConfig,
  SkillTemplateConfigDefinition,
  MediaGenerateRequest,
  Artifact,
} from '@refly/openapi-schema';
import { StateGraphArgs, StateGraph, START, END } from '@langchain/langgraph';
import { GraphState } from '../scheduler/types';
import { Runnable } from '@langchain/core/runnables';
import { SystemMessage } from '@langchain/core/messages';

export class GenerateMedia extends BaseSkill {
  name = 'generateMedia';

  icon: Icon = { type: 'emoji', value: '🎬' };

  configSchema: SkillTemplateConfigDefinition = {
    items: [
      {
        key: 'mediaType',
        inputMode: 'select',
        defaultValue: 'image',
        labelDict: {
          en: 'Media Type',
          'zh-CN': '媒体类型',
        },
        descriptionDict: {
          en: 'Type of media to generate',
          'zh-CN': '要生成的媒体类型',
        },
        options: [
          { value: 'image', labelDict: { en: 'Image', 'zh-CN': '图片' } },
          { value: 'video', labelDict: { en: 'Video', 'zh-CN': '视频' } },
          { value: 'audio', labelDict: { en: 'Audio', 'zh-CN': '音频' } },
        ],
      },
      {
        key: 'provider',
        inputMode: 'select',
        defaultValue: 'replicate',
        labelDict: {
          en: 'Provider',
          'zh-CN': '提供商',
        },
        descriptionDict: {
          en: 'Media generation provider',
          'zh-CN': '媒体生成提供商',
        },
        options: [
          { value: 'replicate', labelDict: { en: 'Replicate', 'zh-CN': 'Replicate' } },
          { value: 'fal', labelDict: { en: 'Fal.ai', 'zh-CN': 'Fal.ai' } },
          { value: 'volces', labelDict: { en: 'Volces', 'zh-CN': 'Volces' } },
          { value: 'openai', labelDict: { en: 'OpenAI', 'zh-CN': 'OpenAI' } },
        ],
      },
      {
        key: 'model',
        inputMode: 'input',
        defaultValue: '',
        labelDict: {
          en: 'Model (Optional)',
          'zh-CN': '模型（可选）',
        },
        descriptionDict: {
          en: 'Specific model to use (leave empty for auto-selection)',
          'zh-CN': '指定使用的模型（留空自动选择）',
        },
      },

      // // Image-specific configurations
      // {
      //   key: 'aspectRatio',
      //   inputMode: 'select',
      //   defaultValue: '1:1',
      //   labelDict: {
      //     en: 'Aspect Ratio (Image)',
      //     'zh-CN': '宽高比（图片）',
      //   },
      //   descriptionDict: {
      //     en: 'Image aspect ratio (only for image generation)',
      //     'zh-CN': '图像宽高比（仅用于图片生成）',
      //   },
      //   options: [
      //     { value: '1:1', labelDict: { en: '1:1 (Square)', 'zh-CN': '1:1 (方形)' } },
      //     { value: '16:9', labelDict: { en: '16:9 (Landscape)', 'zh-CN': '16:9 (横屏)' } },
      //     { value: '9:16', labelDict: { en: '9:16 (Portrait)', 'zh-CN': '9:16 (竖屏)' } },
      //     { value: '4:3', labelDict: { en: '4:3 (Standard)', 'zh-CN': '4:3 (标准)' } },
      //     { value: '3:2', labelDict: { en: '3:2 (Photo)', 'zh-CN': '3:2 (照片)' } },
      //   ],
      // },
      // {
      //   key: 'style',
      //   inputMode: 'select',
      //   defaultValue: 'realistic',
      //   labelDict: {
      //     en: 'Style (Image)',
      //     'zh-CN': '风格（图片）',
      //   },
      //   descriptionDict: {
      //     en: 'Image generation style (only for image generation)',
      //     'zh-CN': '图像生成风格（仅用于图片生成）',
      //   },
      //   options: [
      //     { value: 'realistic', labelDict: { en: 'Realistic', 'zh-CN': '真实' } },
      //     { value: 'artistic', labelDict: { en: 'Artistic', 'zh-CN': '艺术' } },
      //     { value: 'cartoon', labelDict: { en: 'Cartoon', 'zh-CN': '卡通' } },
      //     { value: 'anime', labelDict: { en: 'Anime', 'zh-CN': '动漫' } },
      //     { value: 'abstract', labelDict: { en: 'Abstract', 'zh-CN': '抽象' } },
      //   ],
      // },
      // // Video-specific configurations
      // {
      //   key: 'duration',
      //   inputMode: 'select',
      //   defaultValue: '5',
      //   labelDict: {
      //     en: 'Duration (Video)',
      //     'zh-CN': '时长（视频）',
      //   },
      //   descriptionDict: {
      //     en: 'Video duration in seconds (only for video generation)',
      //     'zh-CN': '视频时长（秒）（仅用于视频生成）',
      //   },
      //   options: [
      //     { value: '3', labelDict: { en: '3 seconds', 'zh-CN': '3秒' } },
      //     { value: '5', labelDict: { en: '5 seconds', 'zh-CN': '5秒' } },
      //     { value: '10', labelDict: { en: '10 seconds', 'zh-CN': '10秒' } },
      //     { value: '15', labelDict: { en: '15 seconds', 'zh-CN': '15秒' } },
      //     { value: '30', labelDict: { en: '30 seconds', 'zh-CN': '30秒' } },
      //   ],
      // },
      // {
      //   key: 'fps',
      //   inputMode: 'select',
      //   defaultValue: '24',
      //   labelDict: {
      //     en: 'Frame Rate (Video)',
      //     'zh-CN': '帧率（视频）',
      //   },
      //   descriptionDict: {
      //     en: 'Video frame rate (only for video generation)',
      //     'zh-CN': '视频帧率（仅用于视频生成）',
      //   },
      //   options: [
      //     { value: '12', labelDict: { en: '12 FPS', 'zh-CN': '12帧/秒' } },
      //     { value: '24', labelDict: { en: '24 FPS', 'zh-CN': '24帧/秒' } },
      //     { value: '30', labelDict: { en: '30 FPS', 'zh-CN': '30帧/秒' } },
      //     { value: '60', labelDict: { en: '60 FPS', 'zh-CN': '60帧/秒' } },
      //   ],
      // },
      // // Audio-specific configurations
      // {
      //   key: 'audioType',
      //   inputMode: 'select',
      //   defaultValue: 'music',
      //   labelDict: {
      //     en: 'Audio Type (Audio)',
      //     'zh-CN': '音频类型（音频）',
      //   },
      //   descriptionDict: {
      //     en: 'Type of audio to generate (only for audio generation)',
      //     'zh-CN': '要生成的音频类型（仅用于音频生成）',
      //   },
      //   options: [
      //     { value: 'music', labelDict: { en: 'Music', 'zh-CN': '音乐' } },
      //     { value: 'speech', labelDict: { en: 'Speech', 'zh-CN': '语音' } },
      //     { value: 'sound_effect', labelDict: { en: 'Sound Effect', 'zh-CN': '音效' } },
      //     { value: 'ambient', labelDict: { en: 'Ambient', 'zh-CN': '环境音' } },
      //   ],
      // },
      // {
      //   key: 'audioDuration',
      //   inputMode: 'select',
      //   defaultValue: '30',
      //   labelDict: {
      //     en: 'Duration (Audio)',
      //     'zh-CN': '时长（音频）',
      //   },
      //   descriptionDict: {
      //     en: 'Audio duration in seconds (only for audio generation)',
      //     'zh-CN': '音频时长（秒）（仅用于音频生成）',
      //   },
      //   options: [
      //     { value: '10', labelDict: { en: '10 seconds', 'zh-CN': '10秒' } },
      //     { value: '30', labelDict: { en: '30 seconds', 'zh-CN': '30秒' } },
      //     { value: '60', labelDict: { en: '1 minute', 'zh-CN': '1分钟' } },
      //     { value: '120', labelDict: { en: '2 minutes', 'zh-CN': '2分钟' } },
      //     { value: '300', labelDict: { en: '5 minutes', 'zh-CN': '5分钟' } },
      //   ],
      // },
      // {
      //   key: 'quality',
      //   inputMode: 'select',
      //   defaultValue: 'high',
      //   labelDict: {
      //     en: 'Quality',
      //     'zh-CN': '质量',
      //   },
      //   descriptionDict: {
      //     en: 'Generation quality',
      //     'zh-CN': '生成质量',
      //   },
      //   options: [
      //     { value: 'standard', labelDict: { en: 'Standard', 'zh-CN': '标准' } },
      //     { value: 'high', labelDict: { en: 'High', 'zh-CN': '高质量' } },
      //     { value: 'ultra', labelDict: { en: 'Ultra', 'zh-CN': '超高质量' } },
      //   ],
      // },
    ],
  };

  invocationConfig: SkillInvocationConfig = {};

  description =
    'Generate multimedia content including images, videos, and audio using external generation services with real-time progress tracking';

  schema = z.object({
    query: z.string().describe('The prompt for media generation'),
    mediaFiles: z.array(z.string()).optional().describe('Reference media files for the generation'),
  });

  graphState: StateGraphArgs<BaseSkillState>['channels'] = {
    ...baseStateGraphArgs,
  };

  generateMedia = async (
    state: GraphState,
    config: SkillRunnableConfig,
  ): Promise<Partial<GraphState>> => {
    const { query: stateQuery } = state;
    const { tplConfig } = config.configurable;

    // Get the media generation query from state.query (passed by pilot engine)
    const query = stateQuery || '';

    if (!query) {
      throw new Error('A prompt is required for media generation');
    }

    // Extract configuration values with defaults
    const mediaType = String(tplConfig?.mediaType?.value ?? 'image') as 'image' | 'video' | 'audio';
    const provider = String(tplConfig?.provider?.value ?? 'replicate');
    const model = String(tplConfig?.model?.value ?? 'black-forest-labs/flux-schnell');
    const quality = String(tplConfig?.quality?.value ?? 'high');

    config.metadata.step = { name: 'generateMedia' };

    // Optimize prompt based on media type and configuration
    const optimizedPrompt = this.optimizePrompt(query, mediaType, tplConfig);

    this.engine.logger.log(`Generating ${mediaType} with prompt: ${optimizedPrompt}`);

    // Emit initial event for progress tracking
    this.emitEvent(
      {
        event: 'log',
        log: {
          key: 'media.generating',
          titleArgs: {
            mediaType,
            prompt: query,
            provider,
            model: model || 'auto-selected',
            quality,
          },
        },
      },
      config,
    );

    try {
      // Get resultId first to create artifact
      const generateResponse = await this.engine.service?.generateMedia?.(
        config.configurable?.user,
        {
          mediaType,
          prompt: optimizedPrompt,
          model: model || undefined,
          provider,
        },
      );

      if (!generateResponse?.success || !generateResponse?.resultId) {
        throw new Error('Failed to start media generation');
      }

      const { resultId } = generateResponse;

      // Emit artifact event to create canvas node
      const artifact: Artifact = {
        type: mediaType,
        entityId: resultId,
        title: `Generated ${this.getMediaTypeDisplayName(mediaType)}`,
        status: 'generating',
      };

      this.emitEvent(
        {
          event: 'artifact',
          artifact,
        },
        config,
      );

      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'media.api.request',
            titleArgs: {
              provider,
              model: model || 'auto-selected',
              mediaType,
            },
          },
        },
        config,
      );

      // Poll for media generation completion
      const result = await this.pollMediaGenerationCompletion(resultId, mediaType, config);

      if (!result.success) {
        throw new Error(result.error || 'Media generation failed');
      }

      const responseMessage = {
        content: `${this.getMediaTypeDisplayName(mediaType)} generated successfully!

**Generation Details:**
- Media Type: ${this.getMediaTypeDisplayName(mediaType)}
- Prompt: ${optimizedPrompt}
- Provider: ${provider}
- Model: ${model || 'auto-selected'}
- Quality: ${quality}
- Generation Time: ${result.elapsedTime}
- Output URL: ${result.outputUrl}

The ${mediaType} has been generated and is ready for use.`,
        metadata: {
          contentType: mediaType,
          generationConfig: {
            mediaType,
            provider,
            model,
            quality,
            prompt: optimizedPrompt,
            ...this.getMediaSpecificParams(mediaType, tplConfig),
          },
          outputUrl: result.outputUrl,
          storageKey: result.storageKey,
          resultId: result.resultId,
        },
      };

      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'media.completed',
            titleArgs: {
              mediaType,
              url: result.outputUrl,
              elapsedTime: result.elapsedTime,
            },
          },
        },
        config,
      );

      return { messages: [new SystemMessage(responseMessage)] };
    } catch (error) {
      const errorMessage = `${this.getMediaTypeDisplayName(mediaType)} generation failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`;

      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'media.error',
            titleArgs: {
              mediaType,
              error: errorMessage,
            },
          },
        },
        config,
      );

      throw new Error(errorMessage);
    }
  };

  private async pollMediaGenerationCompletion(
    resultId: string,
    mediaType: 'image' | 'video' | 'audio',
    config: SkillRunnableConfig,
  ): Promise<any> {
    try {
      const user = config.configurable?.user;
      if (!user) {
        throw new Error('User not found in configuration');
      }

      // Configure timeout based on media type
      const timeoutConfig = {
        image: 90 * 1000, // 90 seconds for images
        audio: 5 * 60 * 1000, // 5 minutes for audio
        video: 10 * 60 * 1000, // 10 minutes for video
      };

      const timeout = timeoutConfig[mediaType] || 90 * 1000;
      const pollInterval = 2000; // 2 seconds
      const startTime = Date.now();

      this.engine.logger.log(`Starting polling for ${mediaType} generation, timeout: ${timeout}ms`);

      // Emit initial progress
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'media.started',
            titleArgs: {
              mediaType,
              resultId,
            },
          },
        },
        config,
      );

      // Polling loop with real status checks
      while (Date.now() - startTime < timeout) {
        // Wait for polling interval
        await this.sleep(pollInterval);

        // Check status
        const actionResultResponse = await this.engine.service.getActionResult(user, { resultId });

        console.log('=====> actionResultResponse', actionResultResponse);

        if (!actionResultResponse) {
          throw new Error(actionResultResponse?.errCode || 'Failed to get action result');
        }
        const actionResult = actionResultResponse;

        // Calculate progress based on elapsed time and media type
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(Math.floor((elapsed / timeout) * 90) + 5, 95);

        // Emit progress event
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: 'media.progress',
              titleArgs: {
                progress: estimatedProgress,
                mediaType,
              },
            },
          },
          config,
        );

        // Check if completed
        if (actionResult.status === 'finish') {
          // Emit artifact completion event with media URL
          const completedArtifact: Artifact = {
            type: mediaType,
            entityId: resultId,
            title: `Generated ${this.getMediaTypeDisplayName(mediaType)}`,
            status: 'finish',
            metadata: {
              [`${mediaType}Url`]: actionResult.outputUrl,
              storageKey: actionResult.storageKey,
            },
          };

          this.emitEvent(
            {
              event: 'artifact',
              artifact: completedArtifact,
            },
            config,
          );

          // Emit completion event
          this.emitEvent(
            {
              event: 'log',
              log: {
                key: 'media.completed',
                titleArgs: {
                  mediaType,
                  resultId,
                },
              },
            },
            config,
          );

          this.engine.logger.log(`Media generation completed for ${resultId}`);

          // Return success result with real data
          const elapsedTime = `${Math.round((Date.now() - startTime) / 1000)}s`;
          return {
            success: true,
            resultId,
            status: 'completed',
            mediaType,
            outputUrl: actionResult.outputUrl,
            storageKey: actionResult.storageKey,
            elapsedTime,
          };
        }

        // Check if failed
        if (actionResult.status === 'failed') {
          const errors = actionResult.errors || [];
          this.engine.logger.error(
            `Media generation failed for ${resultId}: ${JSON.stringify(errors)}`,
          );

          const errorMessage = Array.isArray(errors) ? errors.join(', ') : String(errors);
          throw new Error(`Media generation failed: ${errorMessage}`);
        }

        // Continue polling if still executing or waiting
        this.engine.logger.debug(`Media generation status for ${resultId}: ${actionResult.status}`);
      }

      // Timeout reached
      this.engine.logger.warn(`Media generation timeout for ${resultId} after ${timeout}ms`);
      throw new Error(
        `Media generation timeout after ${timeout / 1000}s. Use resultId "${resultId}" to check status later`,
      );
    } catch (error) {
      console.error(error);
      this.engine.logger.error(`Error in media generation: ${error?.message || error}`);
      throw error;
    }
  }

  private async callMediaGenerationService(
    params: MediaGenerateRequest,
    config: SkillRunnableConfig,
  ): Promise<any> {
    try {
      const user = config.configurable?.user;
      if (!user) {
        throw new Error('User not found in configuration');
      }

      this.engine.logger.log(
        `Calling ${params.provider} for ${params.mediaType} generation with model ${params.model || 'auto-selected'}`,
      );

      // Build media generation request
      const mediaRequest: MediaGenerateRequest = {
        mediaType: params.mediaType,
        prompt: params.prompt,
        model: params.model,
        provider: params.provider,
      };

      // Start media generation
      const generateResponse = await this.engine.service?.generateMedia?.(user, mediaRequest);

      console.log('=====> generateResponse', generateResponse);

      if (!generateResponse.success || !generateResponse.resultId) {
        throw new Error(
          generateResponse ? String(generateResponse.resultId) : 'Failed to start media generation',
        );
      }

      const { resultId } = generateResponse;

      // Configure timeout based on media type
      const timeoutConfig = {
        image: 90 * 1000, // 90 seconds for images
        audio: 5 * 60 * 1000, // 5 minutes for audio
        video: 10 * 60 * 1000, // 10 minutes for video
      };

      const timeout = timeoutConfig[params.mediaType] || 90 * 1000;
      const pollInterval = 2000; // 2 seconds
      const startTime = Date.now();

      this.engine.logger.log(
        `Starting polling for ${params.mediaType} generation, timeout: ${timeout}ms`,
      );

      // Emit initial progress
      this.emitEvent(
        {
          event: 'log',
          log: {
            key: 'media.started',
            titleArgs: {
              mediaType: params.mediaType,
              resultId,
            },
          },
        },
        config,
      );

      // Polling loop with real status checks
      while (Date.now() - startTime < timeout) {
        // Wait for polling interval
        await this.sleep(pollInterval);

        // Check status
        const actionResultResponse = await this.engine.service.getActionResult(user, { resultId });

        console.log('=====> actionResultResponse', actionResultResponse);

        if (!actionResultResponse) {
          throw new Error(actionResultResponse?.errCode || 'Failed to get action result');
        }
        const actionResult = actionResultResponse;

        // Calculate progress based on elapsed time and media type
        const elapsed = Date.now() - startTime;
        const estimatedProgress = Math.min(Math.floor((elapsed / timeout) * 90) + 5, 95);

        // Emit progress event
        this.emitEvent(
          {
            event: 'log',
            log: {
              key: 'media.progress',
              titleArgs: {
                progress: estimatedProgress,
                mediaType: params.mediaType,
              },
            },
          },
          config,
        );

        // Check if completed
        if (actionResult.status === 'finish') {
          // Emit completion event
          this.emitEvent(
            {
              event: 'log',
              log: {
                key: 'media.completed',
                titleArgs: {
                  mediaType: params.mediaType,
                  resultId,
                },
              },
            },
            config,
          );

          this.engine.logger.log(`Media generation completed for ${resultId}`);

          // Return success result with real data
          const elapsedTime = `${Math.round((Date.now() - startTime) / 1000)}s`;
          return {
            success: true,
            resultId,
            status: 'completed',
            mediaType: params.mediaType,
            prompt: params.prompt,
            model: params.model,
            provider: params.provider,
            outputUrl: actionResult.outputUrl,
            storageKey: actionResult.storageKey,
            elapsedTime,
          };
        }

        // Check if failed
        if (actionResult.status === 'failed') {
          const errors = actionResult.errors || [];
          this.engine.logger.error(
            `Media generation failed for ${resultId}: ${JSON.stringify(errors)}`,
          );

          const errorMessage = Array.isArray(errors) ? errors.join(', ') : String(errors);
          throw new Error(`Media generation failed: ${errorMessage}`);
        }

        // Continue polling if still executing or waiting
        this.engine.logger.debug(`Media generation status for ${resultId}: ${actionResult.status}`);
      }

      // Timeout reached
      this.engine.logger.warn(`Media generation timeout for ${resultId} after ${timeout}ms`);
      throw new Error(
        `Media generation timeout after ${timeout / 1000}s. Use resultId "${resultId}" to check status later`,
      );
    } catch (error) {
      console.error(error);
      this.engine.logger.error(`Error in media generation: ${error?.message || error}`);
      throw error;
    }
  }

  /**
   * Helper method to sleep for a given duration
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private getMediaSpecificParams(mediaType: string, tplConfig: any): object {
    switch (mediaType) {
      case 'image':
        return {
          aspectRatio: String(tplConfig?.aspectRatio?.value ?? '1:1'),
          style: String(tplConfig?.style?.value ?? 'realistic'),
          width: this.getWidthFromAspectRatio(String(tplConfig?.aspectRatio?.value ?? '1:1')),
          height: this.getHeightFromAspectRatio(String(tplConfig?.aspectRatio?.value ?? '1:1')),
        };
      case 'video':
        return {
          duration: Number(tplConfig?.duration?.value ?? 5),
          fps: Number(tplConfig?.fps?.value ?? 24),
        };
      case 'audio':
        return {
          audioType: String(tplConfig?.audioType?.value ?? 'music'),
          duration: Number(tplConfig?.audioDuration?.value ?? 30),
        };
      default:
        return {};
    }
  }

  private getWidthFromAspectRatio(aspectRatio: string): number {
    const ratioMap: Record<string, number> = {
      '1:1': 1024,
      '16:9': 1920,
      '9:16': 1080,
      '4:3': 1024,
      '3:2': 1536,
    };
    return ratioMap[aspectRatio] || 1024;
  }

  private getHeightFromAspectRatio(aspectRatio: string): number {
    const ratioMap: Record<string, number> = {
      '1:1': 1024,
      '16:9': 1080,
      '9:16': 1920,
      '4:3': 768,
      '3:2': 1024,
    };
    return ratioMap[aspectRatio] || 1024;
  }

  private getFileExtension(mediaType: string): string {
    switch (mediaType) {
      case 'image':
        return 'png';
      case 'video':
        return 'mp4';
      case 'audio':
        return 'mp3';
      default:
        return 'bin';
    }
  }

  private getMediaTypeDisplayName(mediaType: string): string {
    switch (mediaType) {
      case 'image':
        return 'Image';
      case 'video':
        return 'Video';
      case 'audio':
        return 'Audio';
      default:
        return 'Media';
    }
  }

  private optimizePrompt(query: string, mediaType: string, tplConfig: any): string {
    let optimizedPrompt = query;

    switch (mediaType) {
      case 'image':
        optimizedPrompt = this.optimizeImagePrompt(query, {
          aspectRatio: String(tplConfig?.aspectRatio?.value ?? '1:1'),
          style: String(tplConfig?.style?.value ?? 'realistic'),
          quality: String(tplConfig?.quality?.value ?? 'high'),
        });
        break;
      case 'video':
        optimizedPrompt = this.optimizeVideoPrompt(query, {
          duration: Number(tplConfig?.duration?.value ?? 5),
          fps: Number(tplConfig?.fps?.value ?? 24),
          quality: String(tplConfig?.quality?.value ?? 'high'),
        });
        break;
      case 'audio':
        optimizedPrompt = this.optimizeAudioPrompt(query, {
          audioType: String(tplConfig?.audioType?.value ?? 'music'),
          duration: Number(tplConfig?.audioDuration?.value ?? 30),
          quality: String(tplConfig?.quality?.value ?? 'high'),
        });
        break;
    }

    return optimizedPrompt;
  }

  private optimizeImagePrompt(
    query: string,
    config: { aspectRatio: string; style: string; quality: string },
  ): string {
    let optimizedPrompt = query;

    // Add style context
    switch (config.style) {
      case 'realistic':
        optimizedPrompt += ', photorealistic, high detail, natural lighting';
        break;
      case 'artistic':
        optimizedPrompt += ', artistic style, creative composition, expressive';
        break;
      case 'cartoon':
        optimizedPrompt += ', cartoon style, bright colors, simplified forms';
        break;
      case 'anime':
        optimizedPrompt += ', anime style, vibrant colors, detailed character design';
        break;
      case 'abstract':
        optimizedPrompt += ', abstract art, geometric forms, conceptual';
        break;
    }

    // Add quality context
    switch (config.quality) {
      case 'standard':
        optimizedPrompt += ', good quality';
        break;
      case 'high':
        optimizedPrompt += ', high quality, detailed, sharp';
        break;
      case 'ultra':
        optimizedPrompt += ', ultra high quality, extremely detailed, professional photography';
        break;
    }

    // Add aspect ratio context
    if (config.aspectRatio === '16:9') {
      optimizedPrompt += ', wide composition, panoramic view';
    } else if (config.aspectRatio === '9:16') {
      optimizedPrompt += ', vertical composition, portrait orientation';
    } else if (config.aspectRatio === '1:1') {
      optimizedPrompt += ', square composition, balanced layout';
    }

    optimizedPrompt += ', professional quality, well-composed';
    return optimizedPrompt;
  }

  private optimizeVideoPrompt(
    query: string,
    config: { duration: number; fps: number; quality: string },
  ): string {
    let optimizedPrompt = query;

    // Add video-specific context
    optimizedPrompt += ', cinematic, smooth motion, high-quality video';

    // Add duration context
    if (config.duration <= 5) {
      optimizedPrompt += ', quick action, dynamic movement';
    } else if (config.duration <= 15) {
      optimizedPrompt += ', smooth transitions, steady pacing';
    } else {
      optimizedPrompt += ', extended sequence, detailed storytelling';
    }

    // Add quality context
    switch (config.quality) {
      case 'standard':
        optimizedPrompt += ', good video quality';
        break;
      case 'high':
        optimizedPrompt += ', high-definition, crisp details';
        break;
      case 'ultra':
        optimizedPrompt += ', ultra-high-definition, professional cinematography';
        break;
    }

    return optimizedPrompt;
  }

  private optimizeAudioPrompt(
    query: string,
    config: { audioType: string; duration: number; quality: string },
  ): string {
    let optimizedPrompt = query;

    // Add audio type context
    switch (config.audioType) {
      case 'music':
        optimizedPrompt += ', musical composition, harmonious, melodic';
        break;
      case 'speech':
        optimizedPrompt += ', clear voice, natural speech, articulate';
        break;
      case 'sound_effect':
        optimizedPrompt += ', realistic sound effect, crisp audio';
        break;
      case 'ambient':
        optimizedPrompt += ', ambient soundscape, atmospheric, immersive';
        break;
    }

    // Add quality context
    switch (config.quality) {
      case 'standard':
        optimizedPrompt += ', good audio quality';
        break;
      case 'high':
        optimizedPrompt += ', high-fidelity audio, clear sound';
        break;
      case 'ultra':
        optimizedPrompt += ', studio-quality audio, professional recording';
        break;
    }

    return optimizedPrompt;
  }

  toRunnable(): Runnable<any, any> {
    const workflow = new StateGraph<BaseSkillState>({
      channels: this.graphState,
    }).addNode('generateMedia', this.generateMedia);

    workflow.addEdge(START, 'generateMedia');
    workflow.addEdge('generateMedia', END);

    return workflow.compile();
  }
}
