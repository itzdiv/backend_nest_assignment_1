/*
  Resume Service.

  Handles all business logic for resume management:
  - Uploading a resume
  - Listing user's resumes
  - Setting a resume as primary (within transaction)
  - Deleting a resume

  SRS Constraint: Only ONE resume per user may have is_primary = true.
  This is enforced in a transaction: when a new primary is set,
  all other resumes for that user are demoted first.
*/

/*
  Injectable — marks class as NestJS provider.
  NotFoundException — HTTP 404 (resume not found).
  ForbiddenException — HTTP 403 (ownership validation).
  ConflictException — HTTP 409 (FK constraint violation on delete).
*/
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';

/*
  InjectRepository — injects TypeORM repository.
  Repository — generic TypeORM CRUD repository.
  DataSource — connection manager for transactions.
*/
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';

/* Entity class for resumes table */
import { Resume } from 'src/db/entities/resume.entity';

/* Zod DTO types */
import { CreateResumeDto, UpdateResumeDto } from 'src/zod/candidate.zod';

/* Pagination helper */
import { paginate } from 'src/libs/pagination';

@Injectable()
export class ResumeService {
  constructor(
    /* Inject Resume repository for DB operations */
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,

    /* DataSource needed for the primary-switching transaction */
    private readonly dataSource: DataSource,
  ) {}

  /*
    create — uploads a new resume for the user.

    If is_primary = true, runs inside a transaction to
    demote all other resumes first (SRS requirement).

    @param userId — UUID of the authenticated user.
    @param dto    — validated resume body.
    @returns created resume entity.
  */
  async create(userId: string, dto: CreateResumeDto) {
    if (dto.is_primary) {
      /*
        Transaction ensures atomicity:
        1. All existing resumes for user set is_primary = false.
        2. New resume created with is_primary = true.
      */
      return this.dataSource.transaction(async (manager) => {
        const resumeRepo = manager.getRepository(Resume);

        /* Demote all existing primary resumes for this user */
        await resumeRepo
          .createQueryBuilder()
          .update(Resume)
          .set({ is_primary: false })
          .where('user_id = :userId', { userId })
          .andWhere('is_primary = true')
          .execute();

        /* Create the new primary resume */
        const resume = resumeRepo.create({
          user: { id: userId } as any,
          title: dto.title,
          file_url: dto.file_url,
          is_primary: true,
        });

        await resumeRepo.save(resume);
        return resume;
      });
    }

    /* Non-primary resume: simple creation */
    const resume = this.resumeRepository.create({
      user: { id: userId } as any,
      title: dto.title,
      file_url: dto.file_url,
      is_primary: false,
    });

    await this.resumeRepository.save(resume);
    return resume;
  }

  /*
    findAll — lists all resumes for a user with pagination.

    @param userId — UUID of the authenticated user.
    @param page   — current page number.
    @param limit  — items per page.
    @returns paginated list of resumes.
  */
  async findAll(userId: string, page: number, limit: number) {
    const [items, total] = await this.resumeRepository.findAndCount({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items, total, page, limit);
  }

  /*
    setPrimary — sets a specific resume as primary.

    Uses transaction to:
    1. Demote all other resumes.
    2. Promote the selected resume.

    @param userId   — UUID of the authenticated user.
    @param resumeId — UUID of the resume to set as primary.
    @returns updated resume entity.
  */
  async setPrimary(userId: string, resumeId: string) {
    return this.dataSource.transaction(async (manager) => {
      const resumeRepo = manager.getRepository(Resume);

      /* Verify resume exists and belongs to user */
      const resume = await resumeRepo.findOne({
        where: {
          id: resumeId,
          user: { id: userId },
        },
      });

      if (!resume) {
        throw new NotFoundException('Resume not found');
      }

      /* Step 1: Demote all resumes for this user */
      await resumeRepo
        .createQueryBuilder()
        .update(Resume)
        .set({ is_primary: false })
        .where('user_id = :userId', { userId })
        .execute();

      /* Step 2: Promote selected resume */
      resume.is_primary = true;
      await resumeRepo.save(resume);

      return resume;
    });
  }

  /*
    delete — removes a resume.

    Validates ownership before deletion.

    @param userId   — UUID of the authenticated user.
    @param resumeId — UUID of the resume to delete.
    @returns confirmation message.
  */
  async delete(userId: string, resumeId: string) {
    const resume = await this.resumeRepository.findOne({
      where: {
        id: resumeId,
        user: { id: userId },
      },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    /*
      Wrap the removal in a try/catch to handle FK constraint violations.
      If the resume is referenced by job_applications (resume_id FK),
      PostgreSQL will throw error code 23503 (foreign_key_violation).
      We convert that into a user-friendly 409 Conflict response.
    */
    try {
      await this.resumeRepository.remove(resume);
    } catch (err: any) {
      if (err?.code === '23503') {
        throw new ConflictException(
          'Cannot delete resume — it is referenced by one or more job applications',
        );
      }
      throw err;
    }

    return { message: 'Resume deleted successfully' };
  }
}
