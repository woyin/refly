import { Body, Controller, Post } from '@nestjs/common';
import { ImageGeneratorService } from './image-generator.service';
import { ImageGeneratorRequest, ImageGeneratorResponse } from './image-generator.dto';

/**
 * 图片生成控制器
 */
@Controller('v1/image-generator')
export class ImageGeneratorController {
  constructor(private readonly imageGeneratorService: ImageGeneratorService) {}

  /**
   * 生成图片
   * @param request 图片生成请求
   * @returns 图片生成响应
   */
  @Post('generate')
  async generateImage(@Body() request: ImageGeneratorRequest): Promise<ImageGeneratorResponse> {
    return this.imageGeneratorService.generateImage(request);
  }
}
