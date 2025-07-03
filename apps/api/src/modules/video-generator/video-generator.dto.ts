export interface VideoGeneratorRequest {
  apiKey: string;
  provider: 'replicate';
  prompt: string;
  model: string;
  aspectRatio?: string;
}

export interface VideoGeneratorResponse {
  output: string; // URL
}
