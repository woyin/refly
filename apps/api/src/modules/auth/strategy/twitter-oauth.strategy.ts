import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import OAuth2Strategy = require('passport-oauth2');
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class TwitterOauthStrategy extends PassportStrategy(OAuth2Strategy, 'twitter') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      authorizationURL: 'https://twitter.com/i/oauth2/authorize',
      tokenURL: 'https://api.twitter.com/2/oauth2/token',
      clientID: configService.get('auth.twitter.clientId'),
      clientSecret: configService.get('auth.twitter.clientSecret'),
      callbackURL: configService.get('auth.twitter.callbackUrl'),
      scope: [
        'tweet.read',
        'tweet.write',
        'users.read',
        'follows.read',
        'follows.write',
        'like.read',
        'like.write',
        'list.read',
        'list.write',
        'dm.read',
        'dm.write',
        'media.write',
        'offline.access',
      ],
      state: true,
      pkce: true,
      passReqToCallback: true,
    });
  }

  async validate(req: Request, accessToken: string, refreshToken: string, profile: any) {
    console.log('Twitter OAuth validate method triggered');
    console.log('Request query:', req?.query);
    console.log('Access token present:', !!accessToken);
    console.log('Refresh token present:', !!refreshToken);
    console.log('Profile:', profile);

    const scope = req?.query?.scope as string;
    const scopes = scope ? scope.split(' ') : [];
    console.log('Parsed scopes:', scopes);

    // Extract uid from state
    let uid: string | undefined;
    const state = req?.query?.state as string;
    console.log('Raw state:', state);

    if (state) {
      try {
        const stateObj = JSON.parse(state);
        uid = stateObj.uid;
        console.log('Parsed state object:', stateObj);
        console.log('Extracted uid:', uid);
      } catch (error) {
        console.log('State parsing error:', error);
        // Ignore parsing errors
      }
    }

    // Transform Twitter profile to match expected format
    const transformedProfile = {
      provider: 'twitter',
      id: profile?.id,
      displayName: profile?.displayName || profile?.username,
      emails: profile?.emails || [],
      photos: profile?.photos || [],
    };
    console.log('Transformed profile:', transformedProfile);

    try {
      console.log('Calling authService.oauthValidate...');
      const user = await this.authService.oauthValidate(
        accessToken,
        refreshToken,
        transformedProfile,
        scopes,
        uid,
      );
      console.log('authService.oauthValidate completed successfully');
      console.log('Returned user:', user);
      return user;
    } catch (error) {
      console.log('authService.oauthValidate failed:', error);
      throw error;
    }
  }
}
