/*
  Unit Tests — JobService.

  Tests job creation (with QB snapshot), listing,
  fetching, updating, status change, soft delete,
  and public jobs browsing logic.
*/
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { JobService } from './job.service';
import { JobListing } from 'src/db/entities/job-listing.entity';
import { QuestionBank } from 'src/db/entities/question-bank.entity';
import { JobStatus, JobVisibility } from 'src/db/enums';
import { DataSource } from 'typeorm';

describe('JobService', () => {
  let service: JobService;

  const mockJobRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  const mockQbRepo = {
    findOne: jest.fn(),
  };

  /* Transaction mock */
  const mockManager = { getRepository: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn((cb: any) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobService,
        { provide: getRepositoryToken(JobListing), useValue: mockJobRepo },
        { provide: getRepositoryToken(QuestionBank), useValue: mockQbRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<JobService>(JobService);
    jest.clearAllMocks();
  });

  /* ─── create ─── */

  describe('create', () => {
    it('should create a job with question bank snapshot', async () => {
      /* Mock QB repo for snapshot */
      mockQbRepo.findOne.mockResolvedValue({
        id: 'qb1',
        questions_json: [{ id: 'q1', question: 'Years?' }],
      });

      const txJobRepo = {
        create: jest.fn().mockReturnValue({
          id: 'j1',
          title: 'Dev',
          status: 'ACTIVE',
          created_at: new Date(),
        }),
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockManager.getRepository.mockReturnValue(txJobRepo);

      const result = await service.create('c1', 'u1', {
        title: 'Dev',
        description: 'Desc',
        employment_type: 'FULL_TIME',
        application_mode: 'STANDARD',
        visibility: 'PUBLIC',
        status: 'ACTIVE',
        question_bank_id: 'qb1',
      });

      expect(result.id).toBe('j1');
      expect(txJobRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          screening_questions_json: [{ id: 'q1', question: 'Years?' }],
        }),
      );
    });

    it('should create a job without question bank', async () => {
      const txJobRepo = {
        create: jest.fn().mockReturnValue({
          id: 'j1',
          title: 'Dev',
          status: 'ACTIVE',
          created_at: new Date(),
        }),
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockManager.getRepository.mockReturnValue(txJobRepo);

      const result = await service.create('c1', 'u1', {
        title: 'Dev',
        description: 'Desc',
        employment_type: 'FULL_TIME',
        application_mode: 'STANDARD',
        visibility: 'PUBLIC',
        status: 'ACTIVE',
      });

      expect(result.id).toBe('j1');
    });

    it('should throw NotFoundException if question bank not found', async () => {
      mockQbRepo.findOne.mockResolvedValue(null);
      mockManager.getRepository.mockReturnValue({});

      await expect(
        service.create('c1', 'u1', {
          title: 'Dev',
          description: 'Desc',
          employment_type: 'FULL_TIME',
          application_mode: 'STANDARD',
          visibility: 'PUBLIC',
          status: 'ACTIVE',
          question_bank_id: 'bad-qb',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ─── findOne ─── */

  describe('findOne', () => {
    it('should return job if found', async () => {
      const job = { id: 'j1', title: 'Dev', deleted_at: null };
      mockJobRepo.findOne.mockResolvedValue(job);

      const result = await service.findOne('c1', 'j1');
      expect(result).toEqual(job);
    });

    it('should throw NotFoundException if not found', async () => {
      mockJobRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('c1', 'bad')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ─── findAll ─── */

  describe('findAll', () => {
    it('should return paginated job list', async () => {
      /* Mock autoCloseExpiredJobs (it uses createQueryBuilder) */
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      mockJobRepo.createQueryBuilder.mockReturnValue(qb);

      mockJobRepo.findAndCount.mockResolvedValue([
        [{ id: 'j1', title: 'Dev' }],
        1,
      ]);

      const result = await service.findAll('c1', 1, 10);

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  /* ─── updateStatus ─── */

  describe('updateStatus', () => {
    it('should update job status', async () => {
      const job = { id: 'j1', title: 'Dev', status: 'ACTIVE' };
      mockJobRepo.findOne.mockResolvedValue(job);
      mockJobRepo.save.mockResolvedValue(undefined);

      const result = await service.updateStatus('c1', 'j1', {
        status: 'CLOSED',
      });

      expect(result.status).toBe('CLOSED');
    });
  });

  /* ─── softDelete ─── */

  describe('softDelete', () => {
    it('should set deleted_at timestamp', async () => {
      const job = { id: 'j1', deleted_at: null };
      mockJobRepo.findOne.mockResolvedValue(job);
      mockJobRepo.save.mockResolvedValue(undefined);

      const result = await service.softDelete('c1', 'j1');

      expect(result.message).toContain('deleted');
      expect(job.deleted_at).not.toBeNull();
    });
  });

  /* ─── findPublicJobs ─── */

  describe('findPublicJobs', () => {
    it('should return public active jobs', async () => {
      mockJobRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'j1',
            title: 'Dev',
            description: 'Desc',
            company: { name: 'Acme' },
            created_at: new Date(),
          },
        ],
        1,
      ]);

      const result = await service.findPublicJobs(1, 10);

      expect(result.meta.total).toBe(1);
      expect(result.data[0].company_name).toBe('Acme');
    });
  });
});
