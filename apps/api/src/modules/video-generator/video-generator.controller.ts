import { Body, Controller, Post } from '@nestjs/common';
import { VideoGeneratorService } from './video-generator.service';
import { VideoGeneratorRequest, VideoGeneratorResponse } from './video-generator.dto';

@Controller('v1/video-generator')
export class VideoGeneratorController {
  constructor(private readonly VideoGeneratorService: VideoGeneratorService) {}

  @Post('generate')
  async generateVideo(@Body() request: VideoGeneratorRequest): Promise<VideoGeneratorResponse> {
    return this.VideoGeneratorService.generateVideo(request);
  }
}
