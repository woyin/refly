import { Module } from '@nestjs/common';
import { ImageGeneratorController } from './image-generator.controller';
import { ImageGeneratorService } from './image-generator.service';

/**
 * 图片生成模块
 */
@Module({
  controllers: [ImageGeneratorController],
  providers: [ImageGeneratorService],
  exports: [ImageGeneratorService],
})
export class ImageGeneratorModule {}
