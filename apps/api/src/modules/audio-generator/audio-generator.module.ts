import { Module } from '@nestjs/common';
import { AudioGeneratorController } from './audio-generator.controller';
import { AudioGeneratorService } from './audio-generator.service';

/**
 * 音频生成模块
 */
@Module({
  controllers: [AudioGeneratorController],
  providers: [AudioGeneratorService],
  exports: [AudioGeneratorService],
})
export class AudioGeneratorModule {}
