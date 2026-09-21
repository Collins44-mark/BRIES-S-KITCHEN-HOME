import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export interface AuthRequestUser {
  id: string;
  email: string;
  username: string;
  role: string;
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthRequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
