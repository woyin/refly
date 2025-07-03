import { Injectable } from '@nestjs/common';
import { AudioGeneratorRequest, AudioGeneratorResponse } from './audio-generator.dto';
import { ReplicateAudioGenerator } from '@refly/providers';

/**
 * 音频生成服务
 */
@Injectable()
export class AudioGeneratorService {
  /**
   * 生成音频
   * @param request 音频生成请求
   * @returns 音频生成响应
   */
  async generateAudio(request: AudioGeneratorRequest): Promise<AudioGeneratorResponse> {
    try {
      if (request.provider === 'replicate') {
        return await this.generateWithReplicate(request);
      }
      throw new Error(`Unsupported provider: ${request.provider}`);
    } catch (error) {
      console.error('Audio generation failed:', error);
      throw error;
    }
  }

  /**
   * 使用Replicate生成音频
   * @param request 音频生成请求
   * @returns 音频生成响应
   */
  private async generateWithReplicate(
    request: AudioGeneratorRequest,
  ): Promise<AudioGeneratorResponse> {
    const generator = new ReplicateAudioGenerator();

    const result = await generator.generate({
      apiKey: request.apiKey,
      model: request.model,
      prompt: request.prompt,
    });

    return {
      output: result.output,
    };
  }
}
