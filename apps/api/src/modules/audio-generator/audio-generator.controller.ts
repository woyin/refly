import { Body, Controller, Post } from '@nestjs/common';
import { AudioGeneratorService } from './audio-generator.service';
import { AudioGeneratorRequest, AudioGeneratorResponse } from './audio-generator.dto';

/**
 * 音频生成控制器
 */
@Controller('v1/audio-generator')
export class AudioGeneratorController {
  constructor(private readonly audioGeneratorService: AudioGeneratorService) {}

  /**
   * 生成音频
   * @param request 音频生成请求
   * @returns 音频生成响应
   */
  @Post('generate')
  async generateAudio(@Body() request: AudioGeneratorRequest): Promise<AudioGeneratorResponse> {
    return this.audioGeneratorService.generateAudio(request);
  }
}
