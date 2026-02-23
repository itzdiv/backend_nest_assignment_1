/*
  Roles Decorator.

  Custom decorator that attaches role metadata to route handlers.
  Used together with RoleGuard to implement role-based access control.

  Usage:
    @Roles('OWNER', 'ADMIN')
    @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
    @Post()
    async someMethod() { ... }
*/

/*
  SetMetadata — NestJS function that attaches key-value metadata
  to a route handler. This metadata is later read by Reflector
  inside RoleGuard.
*/
import { SetMetadata } from '@nestjs/common';

/*
  ROLES_KEY — unique metadata key string.
  RoleGuard uses this same key to retrieve the allowed roles.
*/
export const ROLES_KEY = 'roles';

/*
  Roles — parameter decorator factory.

  Takes any number of role strings and stores them
  as metadata on the route handler using ROLES_KEY.

  Example:
    @Roles('OWNER', 'ADMIN')
    → sets metadata { roles: ['OWNER', 'ADMIN'] }
*/
export const Roles = (...roles: string[]) =>
  SetMetadata(ROLES_KEY, roles);
