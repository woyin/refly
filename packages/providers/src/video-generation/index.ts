import { VideoGenerationProvider } from '../types';
import { BaseVideoGenerator } from './base';
import { ReplicateVideoGenerator, ReplicateVideoConfig } from './replicate';
import { FALVideoGenerator, FALVideoConfig } from './fal';

/**
 * 获取视频生成器实例
 * @param config 视频生成提供商配置
 * @param _context 上下文信息（可选）
 * @returns 视频生成器实例
 */
export function getVideoGenerator(
  config: VideoGenerationProvider,
  _context?: { userId?: string },
): BaseVideoGenerator {
  let generator: BaseVideoGenerator;

  switch (config.providerKey) {
    case 'replicate':
      generator = new ReplicateVideoGenerator(config as ReplicateVideoConfig);
      break;

    case 'fal':
      generator = new FALVideoGenerator(config as FALVideoConfig);
      break;

    default:
      throw new Error(`Unsupported video generation provider: ${config.providerKey}`);
  }

  // TODO: 在可用时应用监控包装器
  // return wrapVideoGeneratorWithMonitoring(generator, {
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

// 从主类型文件重新导出类型
export type {
  GenerationRequest,
  GenerationResponse,
  GeneratedMedia,
  VideoGenerationProvider,
} from '../types';
