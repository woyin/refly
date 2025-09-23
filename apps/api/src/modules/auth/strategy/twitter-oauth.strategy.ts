import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from '@superfaceai/passport-twitter-oauth2';
import { AuthService } from '../auth.service';
import { Request } from 'express';

@Injectable()
export class TwitterOauthStrategy extends PassportStrategy(Strategy, 'twitter') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      clientID: configService.get('auth.twitter.clientId'),
      clientSecret: configService.get('auth.twitter.clientSecret'),
      callbackURL: configService.get('auth.twitter.callbackUrl'),
      scope: ['tweet.read', 'tweet.write', 'users.read'],
    });
  }

  async validate(req: Request, accessToken: string, refreshToken: string, profile: Profile) {
    // OAuth1a doesn't support scopes - permissions are set in Twitter Developer Portal
    // Extract scope from query parameters
    const scope = req?.query?.scope as string;
    const scopes = scope ? scope.split(' ') : [];

    // Extract uid from state
    let uid: string | undefined;
    const state = req?.query?.state as string;
    if (state) {
      try {
        const stateObj = JSON.parse(state);
        uid = stateObj.uid;
      } catch {
        // Ignore parsing errors
      }
    }

    return this.authService.oauthValidate(accessToken, refreshToken, profile, scopes, uid);
  }
}
