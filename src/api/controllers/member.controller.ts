/*
  Member Controller.

  Handles HTTP requests for company member management.
  All routes are scoped under /api/v1/companies/:companyId/members.

  Guards applied:
  - JwtAuthGuard: ensures user is authenticated.
  - CompanyMembershipGuard: ensures user belongs to this company.
  - RoleGuard: ensures user has the required role.
*/

/*
  NestJS decorators:
  @Controller — registers route handler.
  @Post, @Get, @Patch, @Delete — HTTP method decorators.
  @UseGuards — applies guard middleware.
  @Body — extracts request body.
  @Param — extracts URL parameters.
  @Query — extracts query string parameters.
  @Req — injects raw Express request.
*/
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';

/* Service containing member business logic */
import { MemberService } from '../services/member.service';

/* Guards for auth, membership, and role checks */
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CompanyMembershipGuard } from '../guards/company-membership.guard';
import { RoleGuard } from '../guards/role.guard';

/* Zod validation pipe — validates request body against schema */
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/* Roles decorator — declares which roles can access a route */
import { Roles } from '../decorators/roles.decorator';

/* Zod schemas — runtime values used by ZodValidationPipe */
import {
  InviteMemberSchema,
  UpdateMemberRoleSchema,
} from 'src/zod/job.zod';
import { PaginationSchema } from 'src/zod/pagination.zod';

/* DTO types — type-only imports (required by isolatedModules + emitDecoratorMetadata) */
import type { InviteMemberDto, UpdateMemberRoleDto } from 'src/zod/job.zod';
import type { PaginationDto } from 'src/zod/pagination.zod';

/*
  Route: /api/v1/companies/:companyId/members
  All members endpoints are nested under a company.
*/
@Controller('v1/companies/:companyId/members')
export class MemberController {
  constructor(private readonly memberService: MemberService) {}

  /*
    POST /api/v1/companies/:companyId/members
    Invite a new member to the company.
    Only OWNER and ADMIN can invite.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN')
  @Post()
  async inviteMember(
    @Param('companyId') companyId: string,
    @Req() req,
    @Body(new ZodValidationPipe(InviteMemberSchema))
    body: InviteMemberDto,
  ) {
    return this.memberService.inviteMember(companyId, body, req.user.id);
  }

  /*
    GET /api/v1/companies/:companyId/members
    List all members of the company with pagination.
    Any company member can view the list.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard)
  @Get()
  async listMembers(
    @Param('companyId') companyId: string,
    @Query(new ZodValidationPipe(PaginationSchema))
    query: PaginationDto,
  ) {
    return this.memberService.listMembers(
      companyId,
      query.page,
      query.limit,
    );
  }

  /*
    PATCH /api/v1/companies/:companyId/members/:memberId/role
    Update a member's role.
    Only OWNER and ADMIN can change roles.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch(':memberId/role')
  async updateRole(
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
    @Body(new ZodValidationPipe(UpdateMemberRoleSchema))
    body: UpdateMemberRoleDto,
  ) {
    return this.memberService.updateMemberRole(companyId, memberId, body);
  }

  /*
    DELETE /api/v1/companies/:companyId/members/:memberId
    Revoke a member's access.
    Only OWNER and ADMIN can revoke.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN')
  @Delete(':memberId')
  async revokeMember(
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
  ) {
    return this.memberService.revokeMember(companyId, memberId);
  }

  /*
    POST /api/v1/companies/:companyId/members/:memberId/transfer-ownership
    Transfer ownership from current OWNER to another member.
    Only OWNER can perform this action.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER')
  @Post(':memberId/transfer-ownership')
  async transferOwnership(
    @Param('companyId') companyId: string,
    @Param('memberId') memberId: string,
    @Req() req,
  ) {
    return this.memberService.transferOwnership(
      companyId,
      memberId,
      req.user.id,
    );
  }
}
