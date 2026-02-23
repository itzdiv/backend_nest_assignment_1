/*
  Job Controller.

  Handles HTTP requests for job listing management.

  Two route groups:
  1. Company-scoped: /api/v1/companies/:companyId/jobs (CRUD for members)
  2. Public: /api/v1/jobs (browsing for candidates)

  Guards applied per route:
  - JwtAuthGuard: ensures user is authenticated.
  - CompanyMembershipGuard: ensures user belongs to this company.
  - RoleGuard: checks required roles.
*/

/*
  NestJS decorators:
  @Controller — registers route handler with base path.
  @Post, @Get, @Patch, @Delete — HTTP method decorators.
  @UseGuards — applies guard middleware.
  @Body, @Param, @Query, @Req — parameter extraction decorators.
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

/* Service containing job business logic */
import { JobService } from '../services/job.service';

/* Guards for auth, membership, and role checks */
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CompanyMembershipGuard } from '../guards/company-membership.guard';
import { RoleGuard } from '../guards/role.guard';

/* Zod validation pipe */
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/* Roles decorator */
import { Roles } from '../decorators/roles.decorator';

/* Zod schemas — runtime values used by ZodValidationPipe */
import {
  CreateJobSchema,
  UpdateJobSchema,
  UpdateJobStatusSchema,
} from 'src/zod/job.zod';
import { PaginationSchema } from 'src/zod/pagination.zod';

/* DTO types — type-only imports (required by isolatedModules + emitDecoratorMetadata) */
import type { CreateJobDto, UpdateJobDto, UpdateJobStatusDto } from 'src/zod/job.zod';
import type { PaginationDto } from 'src/zod/pagination.zod';

/*
  Route: /api/v1/companies/:companyId/jobs
  All job management routes are nested under a company.
*/
@Controller('v1/companies/:companyId/jobs')
export class JobController {
  constructor(private readonly jobService: JobService) {}

  /*
    POST /api/v1/companies/:companyId/jobs
    Create a new job listing.
    OWNER, ADMIN, RECRUITER can create jobs.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN', 'RECRUITER')
  @Post()
  async create(
    @Param('companyId') companyId: string,
    @Req() req,
    @Body(new ZodValidationPipe(CreateJobSchema))
    body: CreateJobDto,
  ) {
    return this.jobService.create(companyId, req.user.id, body);
  }

  /*
    GET /api/v1/companies/:companyId/jobs
    List all jobs for this company with pagination.
    Any company member can view.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard)
  @Get()
  async findAll(
    @Param('companyId') companyId: string,
    @Query(new ZodValidationPipe(PaginationSchema))
    query: PaginationDto,
  ) {
    return this.jobService.findAll(companyId, query.page, query.limit);
  }

  /*
    GET /api/v1/companies/:companyId/jobs/:jobId
    Get single job details.
    Any company member can view.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard)
  @Get(':jobId')
  async findOne(
    @Param('companyId') companyId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobService.findOne(companyId, jobId);
  }

  /*
    PATCH /api/v1/companies/:companyId/jobs/:jobId
    Update job listing details.
    OWNER, ADMIN, RECRUITER can update.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN', 'RECRUITER')
  @Patch(':jobId')
  async update(
    @Param('companyId') companyId: string,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(UpdateJobSchema))
    body: UpdateJobDto,
  ) {
    return this.jobService.update(companyId, jobId, body);
  }

  /*
    PATCH /api/v1/companies/:companyId/jobs/:jobId/status
    Change job lifecycle status (DRAFT → ACTIVE → CLOSED).
    OWNER, ADMIN, RECRUITER can change status.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN', 'RECRUITER')
  @Patch(':jobId/status')
  async updateStatus(
    @Param('companyId') companyId: string,
    @Param('jobId') jobId: string,
    @Body(new ZodValidationPipe(UpdateJobStatusSchema))
    body: UpdateJobStatusDto,
  ) {
    return this.jobService.updateStatus(companyId, jobId, body);
  }

  /*
    DELETE /api/v1/companies/:companyId/jobs/:jobId
    Soft-delete a job listing.
    OWNER, ADMIN, RECRUITER can delete.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN', 'RECRUITER')
  @Delete(':jobId')
  async softDelete(
    @Param('companyId') companyId: string,
    @Param('jobId') jobId: string,
  ) {
    return this.jobService.softDelete(companyId, jobId);
  }
}

/*
  Public Job Controller.

  Separate controller for candidate-facing job browsing.
  No company membership required — just authentication.

  Route: /api/v1/jobs
*/
@Controller('v1/jobs')
export class PublicJobController {
  constructor(private readonly jobService: JobService) {}

  /*
    GET /api/v1/jobs
    Browse all PUBLIC + ACTIVE jobs across all companies.
    No authentication required — open to everyone.
  */
  @Get()
  async findPublicJobs(
    @Query(new ZodValidationPipe(PaginationSchema))
    query: PaginationDto,
  ) {
    return this.jobService.findPublicJobs(query.page, query.limit);
  }
}
