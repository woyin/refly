/**
 * 音频生成请求接口
 */
export interface AudioGeneratorRequest {
  apiKey: string;
  provider: 'replicate';
  prompt: string;
  model: string;
}

/**
 * 音频生成响应接口
 */
export interface AudioGeneratorResponse {
  output: string; // URL
}
