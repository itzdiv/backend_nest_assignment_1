/*
  Application Controller.

  Handles HTTP requests for job applications:

  Two route groups:
  1. Candidate-facing: /api/v1/candidate/applications
     - Apply to a job
     - View own applications
     - Withdraw an application

  2. Company-facing: /api/v1/companies/:companyId/applications
     - View company applications
     - Accept/Reject applications
     - Add/View comments

  Guards applied per route as needed.
*/

/*
  NestJS decorators:
  @Controller — registers route handler with base path.
  @Post, @Get, @Patch — HTTP method decorators.
  @UseGuards — applies guard middleware.
  @Body, @Param, @Query, @Req — parameter extraction decorators.
*/
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';

/* Service containing application business logic */
import { ApplicationService } from '../services/application.service';

/* Resume service for generating signed download URLs */
import { ResumeService } from '../services/resume.service';

/* Guards */
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CompanyMembershipGuard } from '../guards/company-membership.guard';
import { RoleGuard } from '../guards/role.guard';

/* Zod validation pipe */
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/* Roles decorator */
import { Roles } from '../decorators/roles.decorator';

/* Zod schemas — runtime values used by ZodValidationPipe */
import {
  CreateApplicationSchema,
  UpdateApplicationStatusSchema,
  CreateCommentSchema,
} from 'src/zod/application.zod';
import { PaginationSchema } from 'src/zod/pagination.zod';

/* DTO types — type-only imports (required by isolatedModules + emitDecoratorMetadata) */
import type {
  CreateApplicationDto,
  UpdateApplicationStatusDto,
  CreateCommentDto,
} from 'src/zod/application.zod';
import type { PaginationDto } from 'src/zod/pagination.zod';

/* ──────────────────────────────────────────────
   Candidate Application Controller
   ────────────────────────────────────────────── */

/*
  Route: /api/v1/candidate/applications
  Candidate-facing application endpoints.
  Only JwtAuthGuard needed — no company membership.
*/
@Controller('v1/candidate/applications')
export class CandidateApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
  ) {}

  /*
    POST /api/v1/candidate/applications
    Apply to a job.
    Validates: job is active, resume ownership, no duplicates.
  */
  @UseGuards(JwtAuthGuard)
  @Post()
  async apply(
    @Req() req,
    @Body(new ZodValidationPipe(CreateApplicationSchema))
    body: CreateApplicationDto,
  ) {
    return this.applicationService.apply(req.user.id, body);
  }

  /*
    GET /api/v1/candidate/applications
    View all applications by the authenticated candidate.
    Includes job title, company name, status, comments.
  */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getMyApplications(
    @Req() req,
    @Query(new ZodValidationPipe(PaginationSchema))
    query: PaginationDto,
  ) {
    return this.applicationService.getCandidateApplications(
      req.user.id,
      query.page,
      query.limit,
    );
  }

  /*
    PATCH /api/v1/candidate/applications/:applicationId/withdraw
    Withdraw an application.
    Only the candidate who applied can withdraw.
    Cannot withdraw if already ACCEPTED.
  */
  @UseGuards(JwtAuthGuard)
  @Patch(':applicationId/withdraw')
  async withdraw(
    @Req() req,
    @Param('applicationId') applicationId: string,
  ) {
    return this.applicationService.withdraw(req.user.id, applicationId);
  }
}

/* ──────────────────────────────────────────────
   Company Application Controller
   ────────────────────────────────────────────── */

/*
  Route: /api/v1/companies/:companyId/applications
  Company-facing application management endpoints.
  Requires JWT + company membership + appropriate role.
*/
@Controller('v1/companies/:companyId/applications')
export class CompanyApplicationController {
  constructor(
    private readonly applicationService: ApplicationService,
    private readonly resumeService: ResumeService,
  ) {}

  /*
    GET /api/v1/companies/:companyId/applications
    View all applications for this company's jobs.
    All company members can view.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard)
  @Get()
  async getApplications(
    @Param('companyId') companyId: string,
    @Query(new ZodValidationPipe(PaginationSchema))
    query: PaginationDto,
  ) {
    return this.applicationService.getCompanyApplications(
      companyId,
      query.page,
      query.limit,
    );
  }

  /*
    PATCH /api/v1/companies/:companyId/applications/:applicationId/status
    Accept or reject an application.
    OWNER, ADMIN, RECRUITER can change status.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN', 'RECRUITER')
  @Patch(':applicationId/status')
  async updateStatus(
    @Param('companyId') companyId: string,
    @Param('applicationId') applicationId: string,
    @Req() req,
    @Body(new ZodValidationPipe(UpdateApplicationStatusSchema))
    body: UpdateApplicationStatusDto,
  ) {
    return this.applicationService.updateStatus(
      companyId,
      applicationId,
      body.status,
      req.user.id,
    );
  }

  /*
    POST /api/v1/companies/:companyId/applications/:applicationId/comments
    Add a comment to an application.
    OWNER, ADMIN, RECRUITER can comment.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN', 'RECRUITER')
  @Post(':applicationId/comments')
  async addComment(
    @Param('companyId') companyId: string,
    @Param('applicationId') applicationId: string,
    @Req() req,
    @Body(new ZodValidationPipe(CreateCommentSchema))
    body: CreateCommentDto,
  ) {
    return this.applicationService.addComment(
      companyId,
      applicationId,
      req.user.id,
      body,
    );
  }

  /*
    GET /api/v1/companies/:companyId/applications/:applicationId/resume
    View the resume attached to an application.
    Generates a signed download URL (15-minute expiry).
    All company members can view.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard)
  @Get(':applicationId/resume')
  async getResume(
    @Param('companyId') companyId: string,
    @Param('applicationId') applicationId: string,
  ) {
    const resume = await this.applicationService.getApplicationResume(
      companyId,
      applicationId,
    );

    const signedUrl = await this.resumeService.getDownloadUrl(
      resume.storage_key,
    );

    return {
      download_url: signedUrl,
      filename: resume.original_filename,
      mime_type: resume.mime_type,
      file_size_bytes: resume.file_size_bytes,
      expires_in: 900,
    };
  }

  /*
    GET /api/v1/companies/:companyId/applications/:applicationId/comments
    View all comments on an application.
    All company members can view.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard)
  @Get(':applicationId/comments')
  async getComments(
    @Param('companyId') companyId: string,
    @Param('applicationId') applicationId: string,
  ) {
    return this.applicationService.getComments(
      companyId,
      applicationId,
    );
  }
}
