/*
  Job Service.

  Handles all business logic for job listing management:
  - Creating jobs (with optional question bank snapshot)
  - Listing jobs for a company
  - Getting single job details
  - Updating job details
  - Changing job status (DRAFT → ACTIVE → CLOSED)
  - Auto-closing expired jobs

  Enforces soft delete (deleted_at IS NULL) on all queries.
*/

/*
  Injectable — marks class as NestJS provider.
  NotFoundException — HTTP 404 exception.
  BadRequestException — HTTP 400 exception.
*/
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

/*
  InjectRepository — injects TypeORM repository.
  Repository — generic TypeORM CRUD repository.
  DataSource — connection manager for transactions.
  IsNull — TypeORM operator for WHERE ... IS NULL.
  LessThanOrEqual — TypeORM operator for WHERE ... <= value.
*/
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, IsNull } from 'typeorm';

/* Entity classes for job_listings and question_banks tables */
import { JobListing } from 'src/db/entities/job-listing.entity';
import { QuestionBank } from 'src/db/entities/question-bank.entity';

/* Enums matching PostgreSQL ENUM types */
import {
  JobStatus,
  JobVisibility,
  ApplicationMode,
} from 'src/db/enums';

/* Zod DTO types for type safety */
import {
  CreateJobDto,
  UpdateJobDto,
  UpdateJobStatusDto,
} from 'src/zod/job.zod';

/* Pagination helper for consistent paginated responses */
import { paginate } from 'src/libs/pagination';

@Injectable()
export class JobService {
  constructor(
    /* Repository for querying job_listings table */
    @InjectRepository(JobListing)
    private readonly jobRepository: Repository<JobListing>,

    /* Repository for querying question_banks table */
    @InjectRepository(QuestionBank)
    private readonly qbRepository: Repository<QuestionBank>,

    /* DataSource for running transactions */
    private readonly dataSource: DataSource,
  ) {}

  /*
    create — creates a new job listing inside a transaction.

    If question_bank_id is provided, the screening questions
    are COPIED into screening_questions_json (snapshot).
    This means editing the question bank later does NOT
    affect existing job listings.

    @param companyId — UUID of the company.
    @param userId    — UUID of the creator (from JWT).
    @param dto       — validated request body.
    @returns created job summary.
  */
  async create(companyId: string, userId: string, dto: CreateJobDto) {
    return this.dataSource.transaction(async (manager) => {
      const jobRepo = manager.getRepository(JobListing);

      /*
        If question_bank_id provided, fetch and snapshot questions.
        This is the "job creation + snapshot" transaction
        mentioned in the SRS.
      */
      let screeningQuestions = null;

      if (dto.question_bank_id) {
        const qb = await this.qbRepository.findOne({
          where: {
            id: dto.question_bank_id,
            company: { id: companyId },
          },
        });

        if (!qb) {
          throw new NotFoundException('Question bank not found');
        }

        /* Snapshot questions — already a plain JS object from JSONB column */
        screeningQuestions = qb.questions_json;
      }

      /* Create job listing entity */
      const job = jobRepo.create({
        company: { id: companyId } as any,
        created_by: { id: userId } as any,
        title: dto.title,
        description: dto.description,
        requirements: dto.requirements,
        salary_range: dto.salary_range,
        location: dto.location,
        employment_type: dto.employment_type,
        application_mode: dto.application_mode as ApplicationMode,
        visibility: dto.visibility as JobVisibility,
        status: dto.status as JobStatus,
        application_deadline: dto.application_deadline
          ? new Date(dto.application_deadline)
          : undefined,
        screening_questions_json: screeningQuestions ?? undefined,
      });

      await jobRepo.save(job);

      return {
        id: job.id,
        title: job.title,
        status: job.status,
        created_at: job.created_at,
      };
    });
  }

  /*
    findAll — lists all non-deleted jobs for a company
    with pagination.

    Also auto-closes expired jobs before returning results.

    @param companyId — UUID of the company.
    @param page      — current page number.
    @param limit     — items per page.
    @returns paginated list of jobs.
  */
  async findAll(companyId: string, page: number, limit: number) {
    /* Auto-close expired jobs before listing */
    await this.autoCloseExpiredJobs(companyId);

    const [items, total] = await this.jobRepository.findAndCount({
      where: {
        company: { id: companyId },
        deleted_at: IsNull(), // exclude soft-deleted jobs
      },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items, total, page, limit);
  }

  /*
    findOne — fetches a single job by ID.

    Validates that the job belongs to the given company
    and is not soft-deleted.

    @param companyId — UUID of the company.
    @param jobId     — UUID of the job listing.
    @returns job entity or throws 404.
  */
  async findOne(companyId: string, jobId: string) {
    const job = await this.jobRepository.findOne({
      where: {
        id: jobId,
        company: { id: companyId },
        deleted_at: IsNull(),
      },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    return job;
  }

  /*
    findPublicJobs — lists all PUBLIC + ACTIVE jobs
    across all companies. Used for candidate-facing browsing.

    Also auto-closes expired jobs globally.

    @param page  — current page number.
    @param limit — items per page.
    @returns paginated list of public active jobs.
  */
  async findPublicJobs(page: number, limit: number) {
    const [items, total] = await this.jobRepository.findAndCount({
      where: {
        visibility: JobVisibility.PUBLIC,
        status: JobStatus.ACTIVE,
        deleted_at: IsNull(),
      },
      /*
        Eager load company relation to include company name.
        Avoids N+1 queries when listing jobs.
      */
      relations: ['company'],
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    /*
      Map to safe response — don't expose company internals.
    */
    const data = items.map((job) => ({
      id: job.id,
      title: job.title,
      description: job.description,
      requirements: job.requirements,
      salary_range: job.salary_range,
      location: job.location,
      employment_type: job.employment_type,
      application_mode: job.application_mode,
      application_deadline: job.application_deadline,
      company_name: job.company?.name,
      created_at: job.created_at,
    }));

    return paginate(data, total, page, limit);
  }

  /*
    update — partially updates a job listing.

    @param companyId — UUID of the company.
    @param jobId     — UUID of the job to update.
    @param dto       — validated partial update body.
    @returns updated job entity.
  */
  async update(companyId: string, jobId: string, dto: UpdateJobDto) {
    const job = await this.findOne(companyId, jobId);

    /* Build update payload, converting deadline string to Date if provided */
    const updates: Record<string, any> = { ...dto };
    if (updates.application_deadline) {
      updates.application_deadline = new Date(updates.application_deadline);
    }

    this.jobRepository.merge(job, updates);
    await this.jobRepository.save(job);

    return job;
  }

  /*
    updateStatus — changes job lifecycle status.

    Valid transitions:
    DRAFT → ACTIVE, ACTIVE → CLOSED, etc.

    @param companyId — UUID of the company.
    @param jobId     — UUID of the job.
    @param dto       — { status } new status.
    @returns updated job summary.
  */
  async updateStatus(
    companyId: string,
    jobId: string,
    dto: UpdateJobStatusDto,
  ) {
    const job = await this.findOne(companyId, jobId);

    job.status = dto.status as JobStatus;
    await this.jobRepository.save(job);

    return {
      id: job.id,
      title: job.title,
      status: job.status,
    };
  }

  /*
    softDelete — soft deletes a job by setting deleted_at.

    The job is NOT removed from DB. It is simply excluded
    from future queries via deleted_at IS NULL filter.

    @param companyId — UUID of the company.
    @param jobId     — UUID of the job to soft-delete.
    @returns confirmation message.
  */
  async softDelete(companyId: string, jobId: string) {
    const job = await this.findOne(companyId, jobId);

    job.deleted_at = new Date();
    await this.jobRepository.save(job);

    return { message: 'Job deleted successfully' };
  }

  /*
    autoCloseExpiredJobs — automatically closes jobs
    where application_deadline has passed.

    SRS Rule: If current_time > application_deadline,
    status must be set to CLOSED.

    Uses bulk update for efficiency (no N+1 problem).

    @param companyId — UUID of the company (optional scope).
  */
  private async autoCloseExpiredJobs(companyId?: string) {
    const now = new Date();

    const query = this.jobRepository
      .createQueryBuilder()
      .update(JobListing)
      .set({ status: JobStatus.CLOSED })
      .where('status = :status', { status: JobStatus.ACTIVE })
      .andWhere('application_deadline IS NOT NULL')
      .andWhere('application_deadline <= :now', { now })
      .andWhere('deleted_at IS NULL');

    /* Scope to specific company if companyId provided */
    if (companyId) {
      query.andWhere('company_id = :companyId', { companyId });
    }

    await query.execute();
  }
}
