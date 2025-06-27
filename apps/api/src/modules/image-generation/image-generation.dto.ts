export interface ImageGenerationTestRequest {
  prompt: string;
  negativePrompt?: string;
  provider: 'replicate' | 'fal';
  model: string;
  apiKey?: string;
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  seed?: number;
  count?: number;
}

export interface GeneratedImage {
  url: string;
  width: number;
  height: number;
  format: string;
  seed?: number;
}

export interface GenerationResponse {
  images: GeneratedImage[];
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
    taskId?: string;
  };
}
