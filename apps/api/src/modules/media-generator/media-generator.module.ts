import { Module } from '@nestjs/common';
import { MediaGeneratorController } from './media-generator.controller';
import { MediaGeneratorService } from './media-generator.service';
import { CommonModule } from '../common/common.module';
import { MiscModule } from '../misc/misc.module';

@Module({
  imports: [CommonModule, MiscModule],
  controllers: [MediaGeneratorController],
  providers: [MediaGeneratorService],
  exports: [MediaGeneratorService],
})
export class MediaGeneratorModule {}
