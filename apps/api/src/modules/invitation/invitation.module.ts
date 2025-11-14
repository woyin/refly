import { Module } from '@nestjs/common';
import { InvitationService } from './invitation.service';
import { InvitationController } from './invitation.controller';
import { CommonModule } from '../common/common.module';
import { CreditModule } from '../credit/credit.module';
import { PrismaService } from '../common/prisma.service';

@Module({
  imports: [CommonModule, CreditModule],
  controllers: [InvitationController],
  providers: [InvitationService, PrismaService],
  exports: [InvitationService],
})
export class InvitationModule {}
