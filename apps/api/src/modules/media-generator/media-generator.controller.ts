import { Body, Controller, Post } from '@nestjs/common';
import { MediaGeneratorService } from './media-generator.service';
import { MediaGenerateRequest, MediaGenerateResponse } from './media-generator.dto';

@Controller('v1/media')
export class MediaGeneratorController {
  constructor(private readonly mediaGeneratorService: MediaGeneratorService) {}

  @Post('generate')
  async generateMedia(@Body() request: MediaGenerateRequest): Promise<MediaGenerateResponse> {
    return this.mediaGeneratorService.generateMedia(request);
  }
}
