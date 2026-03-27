/*
  Company Service.

  Contains all business logic for company management.
  Uses TypeORM Repository pattern for database access
  and DataSource for transactional operations.
*/

/*
  Injectable — marks class as a NestJS provider (can be injected).
  NotFoundException — HTTP 404 exception.
*/
import { Injectable, NotFoundException } from '@nestjs/common';

/*
  InjectRepository — decorator to inject TypeORM repository.
  Repository — TypeORM generic repository for CRUD operations.
  DataSource — TypeORM connection manager, needed for transactions.
  IsNull — TypeORM operator for WHERE column IS NULL.
*/
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';

/* Entity classes mapped to database tables */
import { Company } from 'src/db/entities/company.entity';
import { CompanyMember } from 'src/db/entities/company-member.entity';

/* Enums matching PostgreSQL ENUM types */
import { MemberStatus, CompanyRole } from 'src/db/enums';

/* Zod-inferred DTO types for type safety */
import { CreateCompanyDto, UpdateCompanyDto } from 'src/zod/company.zod';

@Injectable()
export class CompanyService {
  constructor(
    /* Inject Company repository for direct DB queries */
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,

    /* Inject CompanyMember repository for membership queries */
    @InjectRepository(CompanyMember)
    private readonly companyMemberRepository: Repository<CompanyMember>,

    /*
      DataSource is required for transactions.
      Transactions ensure multiple DB operations
      succeed or fail together (atomicity).
    */
    private readonly dataSource: DataSource,
  ) {}

  /*
    createCompany — creates a company and assigns
    the creator as OWNER in a single transaction.

    @param dto    — validated request body.
    @param userId — ID of the authenticated user (from JWT).
    @returns created company summary.
  */
  async createCompany(dto: CreateCompanyDto, userId: string) {
    return this.dataSource.transaction(async (manager) => {
      /*
        manager.getRepository() returns a transaction-scoped
        repository. All operations through it share one transaction.
      */
      const companyRepo = manager.getRepository(Company);
      const memberRepo = manager.getRepository(CompanyMember);

      /* 1. Create the company record */
      const company = companyRepo.create({
        name: dto.name,
        description: dto.description,
        logo_url: dto.logo_url,
        website: dto.website,
      });

      await companyRepo.save(company);

      /* 2. Create OWNER membership for the creator */
      const membership = memberRepo.create({
        company: company,
        user: { id: userId } as any,
        role: CompanyRole.OWNER,
        status: MemberStatus.ACTIVE,
      });

      await memberRepo.save(membership);

      return {
        id: company.id,
        name: company.name,
        created_at: company.created_at,
      };
    });
  }

  /*
    getMyCompanies — returns all ACTIVE company memberships
    for the authenticated user with company summary fields.

    @param userId — authenticated user id from JWT.
    @returns list of companies for selector/dashboard.
  */
  async getMyCompanies(userId: string) {
    const memberships = await this.companyMemberRepository.find({
      where: {
        user: { id: userId },
        status: MemberStatus.ACTIVE,
        company: { deleted_at: IsNull() },
      },
      relations: ['company'],
      order: { created_at: 'DESC' },
    });

    return {
      data: memberships.map((membership) => ({
        membership_id: membership.id,
        company_id: membership.company.id,
        company_name: membership.company.name,
        company_logo_url: membership.company.logo_url,
        role: membership.role,
        status: membership.status,
      })),
    };
  }

  /*
    getCompanyById — fetches a single company by ID.
    Excludes soft-deleted companies (deleted_at IS NULL).

    @param companyId — UUID from URL param.
    @returns company entity or throws NotFoundException.
  */
  async getCompanyById(companyId: string) {
    const company = await this.companyRepository.findOne({
      where: {
        id: companyId,
        deleted_at: IsNull(), // exclude soft-deleted companies
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  /*
    updateCompany — partially updates a company's profile.
    Only non-undefined fields from dto are applied.

    @param companyId — UUID from URL param.
    @param dto       — validated partial update body.
    @returns updated company entity.
  */
  async updateCompany(companyId: string, dto: UpdateCompanyDto) {
    const company = await this.companyRepository.findOne({
      where: {
        id: companyId,
        deleted_at: IsNull(),
      },
    });

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    /*
      Use TypeORM's merge() to merge dto fields into existing entity.
      Only fields present in dto will overwrite.
    */
    this.companyRepository.merge(company, dto);

    await this.companyRepository.save(company);

    return company;
  }
}
