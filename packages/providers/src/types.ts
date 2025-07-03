export interface BaseProvider {
  providerKey: string;
  apiKey?: string;
  baseUrl?: string;
}

// 多模态 Provider 基础接口
export interface MultimodalProvider extends BaseProvider {
  model: string;
  maxWidth?: number;
  maxHeight?: number;
  // 异步任务配置
  pollInterval?: number; // 轮询间隔（毫秒）
  maxPollAttempts?: number; // 最大轮询次数
  webhookUrl?: string; // webhook 回调地址（可选）
}

// 图像生成专用配置
export interface ImageGenerationProvider extends MultimodalProvider {
  providerKey: 'replicate' | 'fal' | string;
}

// 视频生成专用配置
export interface VideoGenerationProvider extends MultimodalProvider {
  providerKey: 'replicate' | 'fal' | string;
}

// 音频生成专用配置
export interface AudioGenerationProvider extends MultimodalProvider {
  providerKey: 'replicate' | 'fal' | string;
}

// 统一的生成请求接口
export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string;
  // 媒体特定参数
  width?: number;
  height?: number;
  duration?: number; // 音频/视频
  fps?: number; // 视频帧率
  // 输入媒体
  inputImage?: string;
  inputAudio?: string;
  inputVideo?: string;
  // 通用参数
  seed?: number;
  steps?: number;
  guidance?: number;
  aspectRatio?: string;
  quality?: 'standard' | 'hd';
  count?: number;
}

// 统一的生成响应接口
export interface GenerationResponse {
  outputs: GeneratedMedia[];
  metadata: {
    prompt: string;
    model: string;
    provider: string;
    parameters: Record<string, any>;
    usage?: {
      cost?: number;
      credits?: number;
      processingTime?: number;
    };
    taskId?: string; // 异步任务 ID
  };
}

export interface GeneratedMedia {
  url?: string;
  base64?: string;
  width?: number;
  height?: number;
  duration?: number;
  format: string;
  seed?: number;
}
