import { AudioGenerationProvider } from '../types';
import { BaseAudioGenerator } from './base';
import { ReplicateAudioGenerator, ReplicateAudioConfig } from './replicate';
import { FALAudioGenerator, FALAudioConfig } from './fal';

/**
 * 获取音频生成器实例
 * @param config 音频生成器配置
 * @param _context 上下文信息（可选）
 * @returns 音频生成器实例
 */
export function getAudioGenerator(
  config: AudioGenerationProvider,
  _context?: { userId?: string },
): BaseAudioGenerator {
  let generator: BaseAudioGenerator;

  switch (config.providerKey) {
    case 'replicate':
      generator = new ReplicateAudioGenerator(config as ReplicateAudioConfig);
      break;

    case 'fal':
      generator = new FALAudioGenerator(config as FALAudioConfig);
      break;

    default:
      throw new Error(`Unsupported audio generation provider: ${config.providerKey}`);
  }

  // TODO: 在可用时应用监控包装器
  // return wrapAudioGeneratorWithMonitoring(generator, {
  //   userId: context?.userId,
  //   modelId: config.model,
  //   provider: config.providerKey,
  // });

  return generator;
}

// 导出所有基础类和类型
export * from './base';
export * from './replicate';
export * from './fal';

// 重新导出主要类型文件中的类型
export type {
  GenerationRequest,
  GenerationResponse,
  GeneratedMedia,
  AudioGenerationProvider,
} from '../types';
