import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { CompanyMember } from 'src/db/entities/company-member.entity';
import { MemberStatus } from 'src/db/enums';

@Injectable()
export class CompanyMembershipGuard implements CanActivate {
  /*
    Inject CompanyMember repository.
    We will check if user belongs to company.
  */
  constructor(
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    /*
      JwtAuthGuard must run BEFORE this.
      So request.user must exist.
    */
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('User not authenticated');
    }

    /*
      We assume routes use:
      /companies/:companyId/...

      So companyId comes from URL params.
    */
    const companyId = request.params.companyId;

    if (!companyId) {
      throw new ForbiddenException('Company ID missing in route');
    }

    /*
      Check if user is ACTIVE member of this company.

      Entity uses relation properties (company, user),
      not raw column names (company_id, user_id).
      TypeORM lets us match nested relation ids like this.
    */
    const membership = await this.companyMemberRepository.findOne({
      where: {
        company: { id: companyId },
        user: { id: user.id },
        status: MemberStatus.ACTIVE,
      },
    });

    if (!membership) {
      throw new ForbiddenException(
        'You are not a member of this company',
      );
    }

    /*
      Attach membership to request.
      This will be used by RoleGuard later.
    */
    request.membership = membership;

    return true;
  }
}
