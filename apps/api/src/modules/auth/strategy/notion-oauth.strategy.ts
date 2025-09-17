import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-oauth2';
import { Request } from 'express';
import { AuthService } from '../auth.service';

// Extend session type to include uid
declare module 'express-session' {
  interface SessionData {
    uid?: string;
  }
}

@Injectable()
export class NotionOauthStrategy extends PassportStrategy(Strategy, 'notion') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      authorizationURL: 'https://api.notion.com/v1/oauth/authorize',
      tokenURL: 'https://api.notion.com/v1/oauth/token',
      clientID: configService.get('auth.notion.clientId'),
      clientSecret: configService.get('auth.notion.clientSecret'),
      callbackURL: configService.get('auth.notion.callbackUrl'),
      scope: ['read_content', 'update_content', 'insert_content'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, accessToken: string, refreshToken: string, params: any) {
    const scopes = ['read_content', 'update_content', 'insert_content'];

    // Extract uid from session (stored during initial OAuth request)
    let uid: string | undefined;
    if (req.session?.uid) {
      uid = req.session.uid;
      // Clean up session after use
      req.session.uid = undefined;
    }

    // For Notion OAuth, we need to create a profile object from the token response
    // Notion OAuth returns workspace info in the token response
    const profile = {
      id: params.workspace_id || 'notion-user',
      displayName: params.workspace_name || 'Notion User',
      emails: [{ value: params.owner?.user?.person?.email || 'user@notion.so' }],
      provider: 'notion',
      _json: params,
    };

    return this.authService.oauthValidate(accessToken, refreshToken, profile, scopes, uid);
  }
}
