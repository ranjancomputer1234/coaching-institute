import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Attaches learner JWT when present; allows guests through otherwise. */
@Injectable()
export class OptionalLearnerJwtAuthGuard extends AuthGuard('learner-jwt') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<{
      headers?: { authorization?: string };
    }>();
    if (!request.headers?.authorization) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest<TUser>(err: Error | null, user: TUser): TUser | null {
    if (err || !user) return null;
    return user;
  }
}
