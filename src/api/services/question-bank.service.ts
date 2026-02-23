/*
  Question Bank Service.

  Handles all business logic for question bank management.
  Question banks are templates of screening questions
  that companies use when creating job listings.

  Each question bank belongs to a company and can be
  attached to job listings at creation time.
*/

/*
  Injectable — marks class as NestJS provider.
  NotFoundException — HTTP 404 exception.
*/
import { Injectable, NotFoundException } from '@nestjs/common';

/*
  InjectRepository — injects TypeORM repository for entity.
  Repository — generic TypeORM CRUD repository.
*/
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/* Entity class for question_banks table */
import { QuestionBank } from 'src/db/entities/question-bank.entity';

/* Zod DTO types for type-safe method signatures */
import {
  CreateQuestionBankDto,
  UpdateQuestionBankDto,
} from 'src/zod/job.zod';

/* Pagination helper for consistent paginated responses */
import { paginate } from 'src/libs/pagination';

@Injectable()
export class QuestionBankService {
  constructor(
    /* Inject QuestionBank repository for DB operations */
    @InjectRepository(QuestionBank)
    private readonly qbRepository: Repository<QuestionBank>,
  ) {}

  /*
    create — creates a new question bank for a company.

    @param companyId — UUID of the company.
    @param userId    — UUID of the creator (from JWT).
    @param dto       — { name, questions_json } validated body.
    @returns created question bank record.
  */
  async create(
    companyId: string,
    userId: string,
    dto: CreateQuestionBankDto,
  ) {
    const qb = this.qbRepository.create({
      company: { id: companyId } as any,
      created_by: { id: userId } as any,
      name: dto.name,
      questions_json: dto.questions_json,
    });

    await this.qbRepository.save(qb);

    return {
      id: qb.id,
      name: qb.name,
      questions_json: qb.questions_json,
      created_at: qb.created_at,
    };
  }

  /*
    findAll — lists all question banks for a company
    with pagination support.

    @param companyId — UUID of the company.
    @param page      — current page number.
    @param limit     — items per page.
    @returns paginated list of question banks.
  */
  async findAll(companyId: string, page: number, limit: number) {
    const [items, total] = await this.qbRepository.findAndCount({
      where: { company: { id: companyId } },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items, total, page, limit);
  }

  /*
    findOne — fetches a single question bank by ID.

    Validates that the question bank belongs to the given company.

    @param companyId — UUID of the company.
    @param qbId      — UUID of the question bank.
    @returns question bank entity or throws 404.
  */
  async findOne(companyId: string, qbId: string) {
    const qb = await this.qbRepository.findOne({
      where: {
        id: qbId,
        company: { id: companyId },
      },
    });

    if (!qb) {
      throw new NotFoundException('Question bank not found');
    }

    return qb;
  }

  /*
    update — partially updates a question bank.

    @param companyId — UUID of the company.
    @param qbId      — UUID of the question bank to update.
    @param dto       — partial update body.
    @returns updated question bank entity.
  */
  async update(
    companyId: string,
    qbId: string,
    dto: UpdateQuestionBankDto,
  ) {
    const qb = await this.findOne(companyId, qbId);

    /* Merge incoming fields into existing entity */
    Object.assign(qb, dto);

    await this.qbRepository.save(qb);

    return qb;
  }
}
