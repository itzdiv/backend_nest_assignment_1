/*
  Member Service.

  Handles all business logic for company member management:
  - Inviting new members
  - Listing members
  - Updating member roles
  - Revoking members
  - Transferring ownership

  Uses TypeORM Repository pattern for database access.
*/

/*
  Injectable — marks class as NestJS provider.
  BadRequestException — HTTP 400.
  NotFoundException — HTTP 404.
  ForbiddenException — HTTP 403.
*/
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

/*
  InjectRepository — injects TypeORM repository for an entity.
  Repository — generic TypeORM repository with CRUD methods.
  DataSource — connection manager for transactions.
*/
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

/* Entity classes */
import { CompanyMember } from 'src/db/entities/company-member.entity';
import { User } from 'src/db/entities/user.entity';

/* Enums for role and status */
import { CompanyRole, MemberStatus } from 'src/db/enums';

/* Zod DTO types */
import { InviteMemberDto, UpdateMemberRoleDto } from 'src/zod/job.zod';

/* Pagination helper for consistent paginated responses */
import { paginate } from 'src/libs/pagination';

@Injectable()
export class MemberService {
  constructor(
    /* Repository for querying company_members table */
    @InjectRepository(CompanyMember)
    private readonly memberRepository: Repository<CompanyMember>,

    /* Repository for querying users table (to find invitee by email) */
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,

    /* DataSource for running transactions */
    private readonly dataSource: DataSource,
  ) {}

  /*
    inviteMember — invites a user to a company.

    Flow:
    1. Find user by email.
    2. Check if already a member.
    3. Create membership with INVITED status.

    @param companyId — UUID of the company.
    @param dto       — { email, role } from request body.
    @param inviterId — UUID of the user performing the invite.
    @returns created membership record.
  */
  async inviteMember(
    companyId: string,
    dto: InviteMemberDto,
    inviterId: string,
  ) {
    /* Find the user being invited by their email */
    const invitee = await this.userRepository.findOne({
      where: { email: dto.email },
    });

    if (!invitee) {
      throw new NotFoundException('User with this email not found');
    }

    /* Check if user is already a member of this company */
    const existing = await this.memberRepository.findOne({
      where: {
        company: { id: companyId },
        user: { id: invitee.id },
      },
    });

    if (existing) {
      throw new BadRequestException(
        'User is already a member of this company',
      );
    }

    /* Create the membership record with ACTIVE status (instant access) */
    const membership = this.memberRepository.create({
      company: { id: companyId } as any,
      user: { id: invitee.id } as any,
      role: dto.role as CompanyRole,
      status: MemberStatus.ACTIVE,
      invited_by: { id: inviterId } as any,
    });

    await this.memberRepository.save(membership);

    return {
      id: membership.id,
      email: dto.email,
      role: membership.role,
      status: membership.status,
    };
  }

  /*
    listMembers — lists all members of a company with pagination.

    Joins user relation to include email in response.
    Filters to only ACTIVE and INVITED members.

    @param companyId — UUID of the company.
    @param page      — current page number.
    @param limit     — items per page.
    @returns paginated list of members.
  */
  async listMembers(companyId: string, page: number, limit: number) {
    const [members, total] = await this.memberRepository.findAndCount({
      where: {
        company: { id: companyId },
      },
      /*
        Eager load user relation to avoid N+1 queries.
        Without this, accessing member.user would trigger
        a separate query for EACH member.
      */
      relations: ['user'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    /*
      Map to safe response shape.
      We don't expose password_hash or other sensitive user fields.
    */
    const data = members.map((m) => ({
      id: m.id,
      email: m.user?.email,
      role: m.role,
      status: m.status,
      created_at: m.created_at,
    }));

    return paginate(data, total, page, limit);
  }

  /*
    updateMemberRole — changes a member's role.

    Cannot downgrade the last OWNER.

    @param companyId — UUID of the company.
    @param memberId  — UUID of the membership record.
    @param dto       — { role } new role to set.
    @returns updated membership summary.
  */
  async updateMemberRole(
    companyId: string,
    memberId: string,
    dto: UpdateMemberRoleDto,
  ) {
    const membership = await this.memberRepository.findOne({
      where: {
        id: memberId,
        company: { id: companyId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    /*
      CRITICAL: Cannot downgrade the last OWNER.
      If current role is OWNER and new role is not OWNER,
      we must check if there are other active OWNERS.
    */
    if (
      membership.role === CompanyRole.OWNER &&
      dto.role !== CompanyRole.OWNER
    ) {
      const ownerCount = await this.memberRepository.count({
        where: {
          company: { id: companyId },
          role: CompanyRole.OWNER,
          status: MemberStatus.ACTIVE,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot downgrade the last OWNER. Transfer ownership first.',
        );
      }
    }

    membership.role = dto.role as CompanyRole;
    await this.memberRepository.save(membership);

    return {
      id: membership.id,
      role: membership.role,
      status: membership.status,
    };
  }

  /*
    revokeMember — sets a member's status to REVOKED.

    Cannot revoke the last OWNER.

    @param companyId — UUID of the company.
    @param memberId  — UUID of the membership record.
    @returns confirmation message.
  */
  async revokeMember(companyId: string, memberId: string) {
    const membership = await this.memberRepository.findOne({
      where: {
        id: memberId,
        company: { id: companyId },
      },
    });

    if (!membership) {
      throw new NotFoundException('Membership not found');
    }

    /*
      CRITICAL: Cannot revoke the last OWNER.
    */
    if (membership.role === CompanyRole.OWNER) {
      const ownerCount = await this.memberRepository.count({
        where: {
          company: { id: companyId },
          role: CompanyRole.OWNER,
          status: MemberStatus.ACTIVE,
        },
      });

      if (ownerCount <= 1) {
        throw new BadRequestException(
          'Cannot revoke the last OWNER.',
        );
      }
    }

    membership.status = MemberStatus.REVOKED;
    await this.memberRepository.save(membership);

    return { message: 'Member revoked successfully' };
  }

  /*
    transferOwnership — transfers OWNER role to another member.

    Only the current OWNER can do this.
    Uses a transaction to ensure atomicity:
    1. New member becomes OWNER.
    2. Current owner becomes ADMIN.

    @param companyId      — UUID of the company.
    @param targetMemberId — UUID of the member to promote.
    @param currentUserId  — UUID of the current OWNER user.
    @returns confirmation message.
  */
  async transferOwnership(
    companyId: string,
    targetMemberId: string,
    currentUserId: string,
  ) {
    return this.dataSource.transaction(async (manager) => {
      const memberRepo = manager.getRepository(CompanyMember);

      /* Find the current user's membership (must be OWNER) */
      const currentMembership = await memberRepo.findOne({
        where: {
          company: { id: companyId },
          user: { id: currentUserId },
          role: CompanyRole.OWNER,
          status: MemberStatus.ACTIVE,
        },
      });

      if (!currentMembership) {
        throw new ForbiddenException('Only OWNER can transfer ownership');
      }

      /* Find the target member */
      const targetMembership = await memberRepo.findOne({
        where: {
          id: targetMemberId,
          company: { id: companyId },
          status: MemberStatus.ACTIVE,
        },
      });

      if (!targetMembership) {
        throw new NotFoundException('Target member not found');
      }

      /* Promote target to OWNER */
      targetMembership.role = CompanyRole.OWNER;
      await memberRepo.save(targetMembership);

      /* Demote current owner to ADMIN */
      currentMembership.role = CompanyRole.ADMIN;
      await memberRepo.save(currentMembership);

      return { message: 'Ownership transferred successfully' };
    });
  }
}
