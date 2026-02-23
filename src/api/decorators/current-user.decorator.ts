/*
  Custom parameter decorator to extract the authenticated user
  from the request object.

  After JwtAuthGuard runs, it attaches the full User entity
  to request.user. This decorator gives us a clean way to
  access it inside controller methods:

    @Get()
    getMe(@CurrentUser() user: User) { ... }
*/

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/*
  createParamDecorator — NestJS factory for custom parameter decorators.
  ExecutionContext — abstraction over HTTP/WS/RPC request context.
*/

export const CurrentUser = createParamDecorator(
  /*
    data — optional argument passed to decorator (unused here).
    ctx  — execution context, lets us access HTTP request.
  */
  (data: unknown, ctx: ExecutionContext) => {
    /*
      Switch to HTTP context and get the raw Express request.
    */
    const request = ctx.switchToHttp().getRequest();

    /*
      request.user was set by JwtAuthGuard.
      Return entire user object (or undefined if guard didn't run).
    */
    return request.user;
  },
);
