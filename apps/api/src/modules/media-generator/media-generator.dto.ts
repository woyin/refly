export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
}

export interface MediaGenerateRequest {
  mediaType: MediaType;
  apiKey?: string;
  provider?: string;
  prompt: string;
  model?: string;
}

export interface MediaGenerateResponse {
  success: boolean;
  message?: string;
  data?: {
    outputUrl: string;
  };
}
