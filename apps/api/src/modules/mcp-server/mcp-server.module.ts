import { Module } from '@nestjs/common';
import { McpServerController } from './mcp-server.controller';
import { McpServerService } from './mcp-server.service';
import { PrismaService } from '../common/prisma.service';
import { EncryptionService } from '../common/encryption.service';

@Module({
  controllers: [McpServerController],
  providers: [McpServerService, PrismaService, EncryptionService],
  exports: [McpServerService],
})
export class McpServerModule {}
