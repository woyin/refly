export interface ImageGeneratorRequest {
  apiKey: string;
  provider: 'replicate';
  prompt: string;
  model: string;
  aspectRatio?: string;
}

export interface ImageGeneratorResponse {
  output: string; // URL
}
