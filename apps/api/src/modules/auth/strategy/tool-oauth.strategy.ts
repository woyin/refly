import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-google-oauth20';
import { Request } from 'express';

import { AuthService } from '../auth.service';

@Injectable()
export class ToolOauthStrategy extends PassportStrategy(Strategy, 'tool-google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('auth.google.clientId'),
      clientSecret: configService.get('auth.google.clientSecret'),
      callbackURL: `${configService.get('auth.google.callbackUrl')}/tool`,
      scope: ['profile', 'email', 'https://www.googleapis.com/auth/drive'],
      passReqToCallback: true,
    });
  }

  async validate(req: Request, accessToken: string, refreshToken: string, profile: Profile) {
    // Extract scope from query parameters
    const scope = req?.query?.scope as string;
    const scopes = scope ? scope.split(' ') : [];

    return this.authService.toolOAuthValidate(accessToken, refreshToken, profile, scopes);
  }
}
