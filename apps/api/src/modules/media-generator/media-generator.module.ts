import { Module } from '@nestjs/common';
import { MediaGeneratorController } from './media-generator.controller';
import { MediaGeneratorService } from './media-generator.service';
import { PrismaService } from '../common/prisma.service';
import { MiscService } from '../misc/misc.service';

@Module({
  controllers: [MediaGeneratorController],
  providers: [MediaGeneratorService, PrismaService, MiscService],
  exports: [MediaGeneratorService],
})
export class MediaGeneratorModule {}
