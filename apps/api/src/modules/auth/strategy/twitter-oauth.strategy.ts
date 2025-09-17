import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Profile, Strategy } from 'passport-twitter';
import { AuthService } from '../auth.service';

@Injectable()
export class TwitterOauthStrategy extends PassportStrategy(Strategy, 'twitter') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    super({
      consumerKey: configService.get('auth.twitter.consumerKey'),
      consumerSecret: configService.get('auth.twitter.consumerSecret'),
      callbackURL: configService.get('auth.twitter.callbackUrl'),
    });
  }

  async validate(accessToken: string, refreshToken: string, profile: Profile) {
    // OAuth1a doesn't support scopes - permissions are set in Twitter Developer Portal
    const scopes = [];

    return this.authService.oauthValidate(accessToken, refreshToken, profile, scopes);
  }
}
