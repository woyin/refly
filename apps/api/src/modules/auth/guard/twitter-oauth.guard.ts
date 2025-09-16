import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OAuthError } from '@refly/errors';

@Injectable()
export class TwitterOauthGuard extends AuthGuard('twitter') {
  handleRequest(err: any, user: any) {
    console.log('TwitterOauthGuard handleRequest called');
    console.log('Error:', err);
    console.log('User:', user);

    if (err || !user) {
      console.log('Twitter OAuth guard throwing OAuthError');
      throw new OAuthError(); // This will be properly handled by global exception filter
    }

    console.log('Twitter OAuth guard returning user successfully');
    return user;
  }
}
