import { Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { User } from '@refly/openapi-schema';
import { LoginedUser } from '../../../utils/decorators/user.decorator';
import { JwtAuthGuard } from '../../auth/guard/jwt-auth.guard';
import { ConnectionStatusResponse, InitiateConnectionResponse } from './composio.dto';
import { ComposioService } from './composio.service';

@ApiTags('v1/tool/composio')
@Controller('v1/tool/composio')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ComposioController {
  constructor(private readonly composioService: ComposioService) {}

  /**
   * init OAuth connection
   */
  @Post('/:app/authorize')
  @ApiOperation({ summary: 'authorize OAuth connection' })
  @ApiResponse({
    status: 200,
    description: "Generate OAuth authorize URL for user's app",
    type: InitiateConnectionResponse,
  })
  async initiateConnection(
    @LoginedUser() user: User,
    @Param('app') app: string,
  ): Promise<InitiateConnectionResponse> {
    return this.composioService.authApp(user, app);
  }

  /**
   * POST /composio/integrations/:app/revoke
   * Revoke user connection and reset OAuth state
   */
  @Post('/:app/revoke')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke user connection and reset OAuth state' })
  @ApiResponse({
    status: 200,
    description: 'Connection revoked successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'Connection not found',
  })
  async revokeConnection(
    @LoginedUser() user: User,
    @Param('app') app: string,
  ): Promise<{ success: boolean; message: string }> {
    return this.composioService.revokeConnection(user, app);
  }

  /**
   *  query connection status by app slug
   */
  @Get('/:app/status')
  @ApiOperation({ summary: 'query connection status by app slug' })
  @ApiResponse({
    status: 200,
    description: 'connection status query successful',
    type: ConnectionStatusResponse,
  })
  async checkConnectionStatus(
    @LoginedUser() user: User,
    @Param('app') app: string,
  ): Promise<ConnectionStatusResponse> {
    return this.composioService.checkAppStatus(user, app);
  }
}
