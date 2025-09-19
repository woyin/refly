import {
  User,
  MediaGenerateRequest,
  MediaGenerateResponse,
  ToolsetDefinition,
} from '@refly/openapi-schema';
import { ToolParams } from '@langchain/core/tools';
import { AgentBaseTool, AgentBaseToolset, AgentToolConstructor, ToolCallResult } from '../base';
import { z } from 'zod/v3';
import { RunnableConfig } from '@langchain/core/runnables';

export interface ReflyService {
  generateMedia: (user: User, req: MediaGenerateRequest) => Promise<MediaGenerateResponse>;
  processURL: (url: string) => Promise<string>;
  batchProcessURL: (urls: string[]) => Promise<string[]>;
}

export interface GenerateImageFalParams extends ToolParams {
  user: User;
  reflyService: ReflyService;
}

export const GenerateImageFalToolsetDefinition: ToolsetDefinition = {
  key: 'generate_image_fal',
  domain: 'https://fal.ai/',
  labelDict: {
    en: 'Generate Image with FAL',
    'zh-CN': '使用 FAL 生成图像',
  },
  descriptionDict: {
    en: 'Generate image content with FAL.',
    'zh-CN': '使用 FAL 生成图像内容。',
  },
  tools: [
    {
      name: 'generate_image_with_seedream_fal',
      descriptionDict: {
        en: 'Generate image content with Seedream.',
        'zh-CN': '使用 Seedream 生成图像内容。',
      },
    },
  ],
};

export class GenerateImageWithSeedreamFal extends AgentBaseTool<GenerateImageFalParams> {
  name = 'generate_image_with_seedream_fal';
  toolsetKey = GenerateImageFalToolsetDefinition.key;

  schema = z.object({
    prompt: z.string().describe('The prompt to generate image.'),
    image_size: z
      .array(
        z.object({
          preset: z
            .enum([
              'Alice [EN]',
              'Carter [EN]',
              'Frank [EN]',
              'Mary [EN] (Background Music)',
              'Maya [EN]',
              'Anchen [ZH] (Background Music)',
              'Bowen [ZH]',
              'Xinran [ZH]',
            ])
            .describe('Preset of the speaker, match the speakers and language in the script'),
        }),
      )
      .describe(
        'List of speakers to use for the script. If not provided, will be inferred from the script or voice samples. supports up to four speakers at once, example: [{ preset: "Alice [EN]" }, { preset: "Carter [EN]" }]',
      ),
    cfg_scale: z
      .number()
      .describe(
        'CFG (Classifier-Free Guidance) scale for generation. Higher values increase adherence to text. Default value: 1.3',
      )
      .default(1.3),
  });

  description = "Generate long, expressive multi-voice speech using Microsoft's powerful TTS.";

  protected params: GenerateImageFalParams;

  constructor(params: GenerateImageFalParams) {
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
      const result = await reflyService.generateMedia(user, {
        mediaType: 'image',
        prompt: input.prompt,
        model: 'fal-ai/bytedance/seedream/v4/edit',
        provider: 'fal',
        input,
        unitCost: 140,
        wait: true,
        parentResultId: config.configurable?.resultId,
      });

      return {
        status: 'success',
        data: result,
        summary: `Successfully generated image with URL: ${result?.outputUrl}`,
      };
    } catch (error) {
      return {
        status: 'error',
        error: 'Error generating image',
        summary:
          error instanceof Error ? error.message : 'Unknown error occurred while generating image',
      };
    }
  }
}

export class GenerateImageFalToolset extends AgentBaseToolset<GenerateImageFalParams> {
  toolsetKey = GenerateImageFalToolsetDefinition.key;
  tools = [
    GenerateImageWithSeedreamFal,
  ] satisfies readonly AgentToolConstructor<GenerateImageFalParams>[];
}
