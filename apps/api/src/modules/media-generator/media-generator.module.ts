import { Module } from '@nestjs/common';
import { MediaGeneratorController } from './media-generator.controller';
import { MediaGeneratorService } from './media-generator.service';

@Module({
  controllers: [MediaGeneratorController],
  providers: [MediaGeneratorService],
  exports: [MediaGeneratorService],
})
export class MediaGeneratorModule {}
