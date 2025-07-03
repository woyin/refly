import { Body, Controller, Post } from '@nestjs/common';
import { ImageGeneratorService } from './image-generator.service';
import { ImageGeneratorRequest, ImageGeneratorResponse } from './image-generator.dto';

@Controller('v1/image-generator')
export class ImageGeneratorController {
  constructor(private readonly imageGeneratorService: ImageGeneratorService) {}

  @Post('generate')
  async generateImage(@Body() request: ImageGeneratorRequest): Promise<ImageGeneratorResponse> {
    return this.imageGeneratorService.generateImage(request);
  }
}
