import {
  AgentBaseTool,
  AgentBaseToolset,
  AgentToolConstructor,
  BaseToolParams,
  ToolCallResult,
} from '../../base';
import { ToolsetDefinition } from '@refly/openapi-schema';
import { User } from '@refly/openapi-schema';
import { z } from 'zod/v3';
import { RunnableConfig } from '@langchain/core/runnables';
import { ToolParams } from '@langchain/core/tools';

export const GenerateImageWithNanoBananaToolsetDefinition: ToolsetDefinition = {
  key: 'generate_image_with_nano_banana',
  domain: 'https://gemini.google/overview/image-generation',
  labelDict: {
    en: 'Generate Image with Nano Banana',
    'zh-CN': '使用 Nano Banana 生成图片',
  },
  descriptionDict: {
    en: 'Generate image with Nano Banana',
    'zh-CN': '使用 Nano Banana 生成图片',
  },
  tools: [
    {
      name: 'generate_image_with_nano_banana_t2i',
      descriptionDict: {
        en: 'Generate image with Nano Banana T2I',
        'zh-CN': '使用 Nano Banana T2I 生成图片',
      },
    },
    {
      name: 'generate_image_with_nano_banana_i2i',
      descriptionDict: {
        en: 'Generate image with Nano Banana I2I',
        'zh-CN': '使用 Nano Banana I2I 生成图片',
      },
    },
  ],
};

interface BuiltinToolParams extends BaseToolParams, ToolParams {
  user: User;
}

export class GenerateImageWithNanoBananaT2I extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_image_with_nano_banana_t2i';
  toolsetKey = GenerateImageWithNanoBananaToolsetDefinition.key;
  schema = z.object({
    prompt: z.string(),
  });

  description = 'Generate image with Nano Banana T2I';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: any,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      if (!reflyService) {
        throw new Error('Refly service not found');
      }
      const result = await reflyService.generateMedia(user, {
        mediaType: 'image',
        prompt: input.prompt,
        input,
        model: 'nano_banana_t2i',
        parentResultId: config.configurable?.resultId,
      });
      return {
        status: 'success',
        data: result,
        summary: `Successfully generated image with Nano Banana T2I: ${result.outputUrl}`,
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to generate image with Nano Banana T2I');
    }
  }
}

export class GenerateImageWithNanoBananaI2I extends AgentBaseTool<BuiltinToolParams> {
  name = 'generate_image_with_nano_banana_i2i';
  toolsetKey = GenerateImageWithNanoBananaToolsetDefinition.key;
  schema = z.object({
    prompt: z.string(),
  });

  description = 'Generate image with Nano Banana I2I';

  protected params: BuiltinToolParams;

  constructor(params: BuiltinToolParams) {
    super(params);
    this.params = params;
  }

  async _call(
    input: z.infer<typeof this.schema>,
    _: any,
    config: RunnableConfig,
  ): Promise<ToolCallResult> {
    try {
      const { reflyService, user } = this.params;
      if (!reflyService) {
        throw new Error('Refly service not found');
      }
      const result = await reflyService.generateMedia(user, {
        mediaType: 'image',
        prompt: input.prompt,
        input,
        model: 'nano_banana_i2i',
        parentResultId: config.configurable?.resultId,
      });
      return {
        status: 'success',
        data: result,
        summary: `Successfully generated image with Nano Banana I2I: ${result.outputUrl}`,
      };
    } catch (error) {
      console.error(error);
      throw new Error('Failed to generate image with Nano Banana I2I');
    }
  }
}

export class GenerateImageWithNanoBananaToolset extends AgentBaseToolset<BuiltinToolParams> {
  toolsetKey = GenerateImageWithNanoBananaToolsetDefinition.key;
  tools = [
    GenerateImageWithNanoBananaT2I,
    GenerateImageWithNanoBananaI2I,
  ] satisfies readonly AgentToolConstructor<BuiltinToolParams>[];
}
