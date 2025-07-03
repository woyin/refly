/**
 * 音频生成请求接口
 */
export interface AudioGenerationRequest {
  prompt: string;
  model: string;
  apiKey: string;
}

/**
 * 音频生成响应接口
 */
export interface AudioGenerationResponse {
  output: string;
}

/**
 * 音频生成器基类
 */
export abstract class BaseAudioGenerator {
  /**
   * 生成音频
   * @param request 音频生成请求
   * @returns 音频生成响应
   */
  abstract generate(request: AudioGenerationRequest): Promise<AudioGenerationResponse>;
}
