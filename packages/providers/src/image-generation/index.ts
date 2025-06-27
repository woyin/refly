import { ImageGenerationProvider } from '../types';
import { BaseMultimodalGenerator } from './base';
import { ReplicateImageGenerator, ReplicateImageConfig } from './replicate';
import { FALImageGenerator, FALImageConfig } from './fal';

export function getImageGenerator(
  config: ImageGenerationProvider,
  _context?: { userId?: string },
): BaseMultimodalGenerator {
  let generator: BaseMultimodalGenerator;

  switch (config.providerKey) {
    case 'replicate':
      generator = new ReplicateImageGenerator(config as ReplicateImageConfig);
      break;

    case 'fal':
      generator = new FALImageGenerator(config as FALImageConfig);
      break;

    default:
      throw new Error(`Unsupported image generation provider: ${config.providerKey}`);
  }

  // TODO: Apply monitoring wrapper when available
  // return wrapImageGeneratorWithMonitoring(generator, {
  //   userId: context?.userId,
  //   modelId: config.model,
  //   provider: config.providerKey,
  // });

  return generator;
}

// Export all base classes and types
export * from './base';
export * from './replicate';
export * from './fal';

// Re-export types from main types file
export type {
  GenerationRequest,
  GenerationResponse,
  GeneratedMedia,
  ImageGenerationProvider,
} from '../types';
