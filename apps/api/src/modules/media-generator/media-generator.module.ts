import { Module } from '@nestjs/common';
import { MediaGeneratorController } from './media-generator.controller';
import { MediaGeneratorService } from './media-generator.service';
import { PromptProcessorService } from './prompt-processor.service';
import { CommonModule } from '../common/common.module';
import { MiscModule } from '../misc/misc.module';
import { ProviderModule } from '../provider/provider.module';

@Module({
  imports: [CommonModule, MiscModule, ProviderModule],
  controllers: [MediaGeneratorController],
  providers: [MediaGeneratorService, PromptProcessorService],
  exports: [MediaGeneratorService],
})
export class MediaGeneratorModule {}
