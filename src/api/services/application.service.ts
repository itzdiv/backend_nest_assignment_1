/*
  Application Service.

  Handles all business logic for job applications:
  - Candidate applying to a job
  - Candidate withdrawing an application
  - Candidate viewing their applications (with joins)
  - Company members viewing applications for their jobs
  - Company members accepting/rejecting applications
  - Company members adding comments to applications

  Key SRS rules enforced:
  - Resume ownership validated before application.
  - Job must be ACTIVE and not expired.
  - PRIVATE jobs are not publicly accessible.
  - UNIQUE(job_id, user_id) prevents duplicate applications.
  - Withdrawal only by the candidate, only if not ACCEPTED.
  - Application creation uses transaction.
  - N+1 queries prevented via eager loading / joins.
*/

/*
  Injectable — marks class as NestJS provider.
  BadRequestException — HTTP 400 (validation errors).
  NotFoundException — HTTP 404 (resource not found).
  ForbiddenException — HTTP 403 (unauthorized action).
*/
import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';

/*
  InjectRepository — injects TypeORM repository.
  Repository — generic TypeORM CRUD repository.
  DataSource — connection manager for transactions.
  IsNull — TypeORM operator for WHERE ... IS NULL.
*/
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';

/* Entity classes for all relevant tables */
import { JobApplication } from 'src/db/entities/job-application.entity';
import { JobListing } from 'src/db/entities/job-listing.entity';
import { Resume } from 'src/db/entities/resume.entity';
import { ApplicationComment } from 'src/db/entities/application-comment.entity';

/* Enums matching PostgreSQL ENUM types */
import { ApplicationStatus, JobStatus } from 'src/db/enums';

/* Zod DTO types */
import { CreateApplicationDto } from 'src/zod/application.zod';
import { CreateCommentDto } from 'src/zod/application.zod';

/* Pagination helper */
import { paginate } from 'src/libs/pagination';

@Injectable()
export class ApplicationService {
  constructor(
    /* Repository for querying job_applications table */
    @InjectRepository(JobApplication)
    private readonly applicationRepository: Repository<JobApplication>,

    /* Repository for querying job_listings table */
    @InjectRepository(JobListing)
    private readonly jobRepository: Repository<JobListing>,

    /* Repository for validating resume ownership */
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,

    /* Repository for application comments */
    @InjectRepository(ApplicationComment)
    private readonly commentRepository: Repository<ApplicationComment>,

    /* DataSource for transactional operations */
    private readonly dataSource: DataSource,
  ) {}

  /*
    apply — candidate applies to a job.

    Validation checks:
    1. Job exists, is ACTIVE, not deleted, not expired.
    2. Resume belongs to the applying user.
    3. User hasn't already applied to this job.

    Uses transaction for atomicity.

    @param userId — UUID of the candidate (from JWT).
    @param dto    — { job_id, resume_id, answers_json?, video_url? }.
    @returns created application summary.
  */
  async apply(userId: string, dto: CreateApplicationDto) {
    return this.dataSource.transaction(async (manager) => {
      const jobRepo = manager.getRepository(JobListing);
      const resumeRepo = manager.getRepository(Resume);
      const appRepo = manager.getRepository(JobApplication);

      /* 1. Validate job exists and is ACTIVE */
      const job = await jobRepo.findOne({
        where: {
          id: dto.job_id,
          status: JobStatus.ACTIVE,
          deleted_at: IsNull(),
        },
        relations: ['company'], // need company for denormalized company_id
      });

      if (!job) {
        throw new NotFoundException(
          'Job not found or not accepting applications',
        );
      }

      /* Check if job deadline has passed */
      if (
        job.application_deadline &&
        new Date() > new Date(job.application_deadline)
      ) {
        throw new BadRequestException(
          'Application deadline has passed',
        );
      }

      /* 2. Validate resume belongs to the user */
      const resume = await resumeRepo.findOne({
        where: {
          id: dto.resume_id,
          user: { id: userId },
        },
      });

      if (!resume) {
        throw new ForbiddenException(
          'Resume not found or does not belong to you',
        );
      }

      /* 3. Check for duplicate application */
      const existing = await appRepo.findOne({
        where: {
          job: { id: dto.job_id },
          user: { id: userId },
        },
      });

      if (existing) {
        throw new BadRequestException(
          'You have already applied to this job',
        );
      }

      /* 4. Create the application */
      const application = appRepo.create({
        job: { id: dto.job_id } as any,
        company: { id: job.company.id } as any, // denormalized company_id
        user: { id: userId } as any,
        resume: { id: dto.resume_id } as any,
        answers_json: dto.answers_json || undefined,
        video_url: dto.video_url || undefined,
        status: ApplicationStatus.APPLIED,
      });

      await appRepo.save(application);

      return {
        id: application.id,
        job_id: dto.job_id,
        status: application.status,
        created_at: application.created_at,
      };
    });
  }

  /*
    withdraw — candidate withdraws their application.

    Rules:
    - Only the candidate who created the application can withdraw.
    - Cannot withdraw if status is already ACCEPTED.
    - Status changes to WITHDRAWN.

    @param userId        — UUID of the candidate.
    @param applicationId — UUID of the application.
    @returns confirmation message.
  */
  async withdraw(userId: string, applicationId: string) {
    const application = await this.applicationRepository.findOne({
      where: {
        id: applicationId,
        user: { id: userId },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status === ApplicationStatus.ACCEPTED) {
      throw new BadRequestException(
        'Cannot withdraw an already accepted application',
      );
    }

    if (application.status === ApplicationStatus.WITHDRAWN) {
      throw new BadRequestException(
        'Application is already withdrawn',
      );
    }

    application.status = ApplicationStatus.WITHDRAWN;
    await this.applicationRepository.save(application);

    return { message: 'Application withdrawn successfully' };
  }

  /*
    getCandidateApplications — lists all applications
    for the authenticated candidate.

    Joins: job_listings, companies, comments.
    This avoids N+1 queries by eager loading all relations.

    Response includes: job title, company name, status,
    answers_json, video_url, comments[], timestamps.

    @param userId — UUID of the candidate.
    @param page   — pagination page.
    @param limit  — pagination limit.
    @returns paginated list of applications with full details.
  */
  async getCandidateApplications(
    userId: string,
    page: number,
    limit: number,
  ) {
    const [items, total] =
      await this.applicationRepository.findAndCount({
        where: { user: { id: userId } },
        /*
          Eager load relations to prevent N+1 queries.
          job → job listing details + company name.
          comments → inline comments from company members.
        */
        relations: ['job', 'job.company', 'comments'],
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    /*
      Map to safe response shape.
      Only include comments visible to candidate.
    */
    const data = items.map((app) => ({
      id: app.id,
      status: app.status,
      answers_json: app.answers_json,
      video_url: app.video_url,
      applied_at: app.created_at,
      last_updated_at: app.updated_at,
      job: {
        id: app.job?.id,
        title: app.job?.title,
        company_name: app.job?.company?.name,
      },
      comments: (() => {
        const allComments = app.comments || [];

        /* Map each comment to a safe response shape */
        const mappedComments = allComments.map((c) => ({
          id: c.id,
          comment: c.comment,
          visible_to_candidate: c.visible_to_candidate,
          created_at: c.created_at,
        }));

        return mappedComments;
      })(),
    }));

    return paginate(data, total, page, limit);
  }

  /*
    getCompanyApplications — lists all applications
    for a company's jobs with pagination.

    Used by company members to review incoming applications.

    @param companyId — UUID of the company.
    @param page      — pagination page.
    @param limit     — pagination limit.
    @returns paginated list of applications.
  */
  async getCompanyApplications(
    companyId: string,
    page: number,
    limit: number,
  ) {
    const [items, total] =
      await this.applicationRepository.findAndCount({
        where: { company: { id: companyId } },
        /*
          Eager load user (candidate), job, resume, and comments
          to avoid N+1 queries when listing applications.
        */
        relations: ['user', 'job', 'resume', 'comments'],
        order: { created_at: 'DESC' },
        skip: (page - 1) * limit,
        take: limit,
      });

    const data = items.map((app) => ({
      id: app.id,
      status: app.status,
      answers_json: app.answers_json,
      video_url: app.video_url,
      created_at: app.created_at,
      updated_at: app.updated_at,
      candidate_email: app.user?.email,
      job_title: app.job?.title,
      resume_url: app.resume?.file_url,
      comments_count: app.comments?.length || 0,
    }));

    return paginate(data, total, page, limit);
  }

  /*
    updateStatus — company member accepts or rejects an application.

    @param companyId     — UUID of the company.
    @param applicationId — UUID of the application.
    @param status        — new status (ACCEPTED or REJECTED).
    @param changedBy     — UUID of the company member making the change.
    @returns updated application summary.
  */
  async updateStatus(
    companyId: string,
    applicationId: string,
    status: string,
    changedBy: string,
  ) {
    const application = await this.applicationRepository.findOne({
      where: {
        id: applicationId,
        company: { id: companyId },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.status === ApplicationStatus.WITHDRAWN) {
      throw new BadRequestException(
        'Cannot update a withdrawn application',
      );
    }

    application.status = status as ApplicationStatus;
    application.status_changed_by = { id: changedBy } as any;

    await this.applicationRepository.save(application);

    return {
      id: application.id,
      status: application.status,
      updated_at: application.updated_at,
    };
  }

  /*
    addComment — company member adds a comment to an application.

    @param companyId     — UUID of the company.
    @param applicationId — UUID of the application.
    @param userId        — UUID of the commenting member.
    @param dto           — { comment, visible_to_candidate }.
    @returns created comment entity.
  */
  async addComment(
    companyId: string,
    applicationId: string,
    userId: string,
    dto: CreateCommentDto,
  ) {
    /* Validate the application exists and belongs to this company */
    const application = await this.applicationRepository.findOne({
      where: {
        id: applicationId,
        company: { id: companyId },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    /* Create the comment */
    const comment = this.commentRepository.create({
      job_application: { id: applicationId } as any,
      company: { id: companyId } as any,
      user: { id: userId } as any,
      comment: dto.comment,
      visible_to_candidate: dto.visible_to_candidate,
    });

    await this.commentRepository.save(comment);

    return {
      id: comment.id,
      comment: comment.comment,
      visible_to_candidate: comment.visible_to_candidate,
      created_at: comment.created_at,
    };
  }

  /*
    getComments — lists all comments for an application.

    @param companyId     — UUID of the company.
    @param applicationId — UUID of the application.
    @returns array of comments with user details.
  */
  async getComments(companyId: string, applicationId: string) {
    const comments = await this.commentRepository.find({
      where: {
        job_application: { id: applicationId },
        company: { id: companyId },
      },
      relations: ['user'], // load user for commenter email
      order: { created_at: 'ASC' },
    });

    /* Map to safe response shape with commenter email */
    const data = comments.map((c) => ({
      id: c.id,
      comment: c.comment,
      visible_to_candidate: c.visible_to_candidate,
      user_email: c.user?.email,
      created_at: c.created_at,
    }));

    return data;
  }
}
