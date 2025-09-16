import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OAuthError } from '@refly/errors';
import { Request } from 'express';

// Extend session type to include uid
declare module 'express-session' {
  interface SessionData {
    uid?: string;
  }
}

@Injectable()
export class TwitterOauthGuard extends AuthGuard('twitter') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const uid = request.query?.uid as string;

    // Store uid in session before OAuth redirect
    if (uid) {
      request.session.uid = uid;
    }

    // Continue with normal OAuth flow
    return super.canActivate(context) as Promise<boolean>;
  }

  handleRequest(err: any, user: any) {
    if (err || !user) {
      throw new OAuthError(); // This will be properly handled by global exception filter
    }
    return user;
  }
}
