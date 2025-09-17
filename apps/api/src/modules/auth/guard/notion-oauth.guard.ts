import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OAuthError } from '@refly/errors';
import { Request } from 'express';

@Injectable()
export class NotionOauthGuard extends AuthGuard('notion') {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const uid = request.query?.uid as string;

    // Merge uid into existing state parameter for OAuth2 flow
    if (uid) {
      const existingState = request.query?.state as string;
      let stateObj: any = {};

      // Try to parse existing state if it exists
      if (existingState) {
        try {
          stateObj = JSON.parse(existingState);
        } catch {
          // If parsing fails, treat as plain string and convert to object
          stateObj = { originalState: existingState };
        }
      }

      // Add uid to state object
      stateObj.uid = uid;

      // Serialize back to string
      const newState = JSON.stringify(stateObj);
      request.query.state = newState;
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
