import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Connection status enum
 */
export enum ComposioConnectionStatus {
  ACTIVE = 'active',
  REVOKED = 'revoked',
}

/**
 * Connection metadata interface
 */
export interface ComposioConnectionMetadata {
  appName: string;
  category?: string;
  toolkit?: {
    slug: string;
    name: string;
  };
  accountInfo?: {
    email?: string;
    username?: string;
    displayName?: string;
  };
  lastUsedAt?: number;
}

/**
 * Initiate connection request
 */
export class InitiateConnectionRequest {
  @ApiProperty({ description: 'App slug (e.g., gmail, slack)', example: 'gmail' })
  app: string;
}

/**
 * Initiate connection response
 */
export class InitiateConnectionResponse {
  @ApiProperty({ description: 'OAuth redirect URL' })
  redirectUrl: string;

  @ApiProperty({ description: 'Connection request ID from Composio' })
  connectionRequestId: string;

  @ApiProperty({ description: 'App slug' })
  app: string;
}

/**
 * Connection status response
 */
export class ConnectionStatusResponse {
  @ApiProperty({ description: 'Connection status', enum: ComposioConnectionStatus })
  status: ComposioConnectionStatus;

  @ApiPropertyOptional({ description: 'Connected account ID from Composio (if active)' })
  connectedAccountId?: string;

  @ApiPropertyOptional({ description: 'Integration ID (if active)' })
  integrationId?: string;
}

/**
 * 用户连接 DTO
 */
export class ComposioConnectionDTO {
  @ApiProperty({ description: 'User ID' })
  uid: string;

  @ApiProperty({ description: 'Integration ID (e.g., gmail, slack)' })
  integrationId: string;

  @ApiProperty({ description: 'Connected account ID from Composio' })
  connectedAccountId: string;

  @ApiProperty({ description: 'Connection status', enum: ComposioConnectionStatus })
  status: ComposioConnectionStatus;

  @ApiPropertyOptional({ description: 'Connection metadata' })
  metadata?: ComposioConnectionMetadata;

  @ApiPropertyOptional({ description: 'Token expiration date' })
  expiresAt?: string;

  @ApiProperty({ description: 'Created timestamp' })
  createdAt: string;

  @ApiProperty({ description: 'Updated timestamp' })
  updatedAt: string;
}

/**
 * PO 转 DTO
 */
export function composioConnectionPO2DTO(po: any): ComposioConnectionDTO {
  return {
    uid: po.uid,
    integrationId: po.integrationId,
    connectedAccountId: po.connectedAccountId,
    status: po.status as ComposioConnectionStatus,
    metadata: po.metadata ? JSON.parse(po.metadata) : undefined,
    expiresAt: po.expiresAt?.toISOString(),
    createdAt: po.createdAt.toISOString(),
    updatedAt: po.updatedAt.toISOString(),
  };
}
