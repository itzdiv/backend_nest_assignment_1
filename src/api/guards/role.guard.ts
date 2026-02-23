/*
  Role Guard.

  Checks if the authenticated user's company membership
  has the required role to access a route.

  MUST run AFTER:
  1. JwtAuthGuard (sets request.user)
  2. CompanyMembershipGuard (sets request.membership)

  Usage in controllers:
    @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
    @Roles('OWNER', 'ADMIN')
*/

/*
  CanActivate — interface that guards must implement.
  ExecutionContext — provides access to the HTTP request.
  ForbiddenException — HTTP 403 error.
  Injectable — marks this class as a NestJS provider.
*/
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';

/*
  Reflector — NestJS utility to read metadata set by decorators.
  We use it to read the roles set by @Roles() decorator.
*/
import { Reflector } from '@nestjs/core';

/*
  ROLES_KEY — the metadata key used by @Roles() decorator.
*/
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  /*
    Reflector is injected by NestJS DI container.
    It reads metadata attached to route handlers.
  */
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    /*
      Read the roles metadata from the route handler and class.
      getAllAndOverride checks handler first, then class.

      Example: @Roles('OWNER', 'ADMIN') sets ['OWNER', 'ADMIN']
    */
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    /*
      If no @Roles() decorator was applied to the route,
      allow access (no role restriction).
    */
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    /*
      request.membership was set by CompanyMembershipGuard.
      It contains the user's role within the company.
    */
    const membership = request.membership;

    if (!membership) {
      throw new ForbiddenException('Company membership not found');
    }

    /*
      Check if the user's role is in the list of allowed roles.
      membership.role is one of: OWNER, ADMIN, RECRUITER
    */
    const userRole = membership.role;
    const hasPermission = requiredRoles.includes(userRole);

    if (!hasPermission) {
      throw new ForbiddenException(
        `Role ${userRole} is not allowed to perform this action`,
      );
    }

    return true;
  }
}
