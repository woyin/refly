import { BaseAudioGenerator, AudioGenerationRequest, AudioGenerationResponse } from './base';

/**
 * Replicate音频生成器
 */
export class ReplicateAudioGenerator extends BaseAudioGenerator {
  /**
   * 使用Replicate API生成音频
   * @param request 音频生成请求
   * @returns 音频生成响应
   */
  async generate(request: AudioGenerationRequest): Promise<AudioGenerationResponse> {
    const url = `https://api.replicate.com/v1/models/${request.model}/predictions`;

    const headers = {
      Authorization: `Bearer ${process.env.REPLICATE_API_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'wait',
    };

    const data = {
      input: {
        prompt: request.prompt,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Replicate API error: ${response.status} ${response.statusText} - ${errorText}`,
      );
    }

    const result = await response.json();

    if (!result.output) {
      throw new Error('No output URL found in response');
    }

    return {
      output: Array.isArray(result.output) ? result.output[0] : result.output,
    };
  }
}
