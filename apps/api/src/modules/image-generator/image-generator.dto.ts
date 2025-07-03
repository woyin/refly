/**
 * 图片生成请求接口
 */
export interface ImageGeneratorRequest {
  apiKey: string;
  provider: 'replicate';
  prompt: string;
  model: string;
  aspectRatio?: string;
}

/**
 * 图片生成响应接口
 */
export interface ImageGeneratorResponse {
  output: string; // 生成图片的URL
}
