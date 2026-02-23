/*
  Unit Tests — ApplicationService.

  Tests apply, withdraw, candidate/company listings,
  status update, and comment operations with mocked repos.
*/
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { ApplicationService } from './application.service';
import { JobApplication } from 'src/db/entities/job-application.entity';
import { JobListing } from 'src/db/entities/job-listing.entity';
import { Resume } from 'src/db/entities/resume.entity';
import { ApplicationComment } from 'src/db/entities/application-comment.entity';
import { ApplicationStatus, JobStatus } from 'src/db/enums';
import { DataSource } from 'typeorm';

describe('ApplicationService', () => {
  let service: ApplicationService;

  const mockAppRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    save: jest.fn(),
  };
  const mockJobRepo = {};
  const mockResumeRepo = {};
  const mockCommentRepo = {
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
  };

  /* Transaction mock */
  const mockManager = { getRepository: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn((cb: any) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplicationService,
        { provide: getRepositoryToken(JobApplication), useValue: mockAppRepo },
        { provide: getRepositoryToken(JobListing), useValue: mockJobRepo },
        { provide: getRepositoryToken(Resume), useValue: mockResumeRepo },
        { provide: getRepositoryToken(ApplicationComment), useValue: mockCommentRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ApplicationService>(ApplicationService);
    jest.clearAllMocks();
  });

  /* ─── apply ─── */

  describe('apply', () => {
    it('should create an application in a transaction', async () => {
      const txJobRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'j1',
          status: JobStatus.ACTIVE,
          company: { id: 'c1' },
          application_deadline: null,
        }),
      };
      const txResumeRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'r1' }),
      };
      const txAppRepo = {
        findOne: jest.fn().mockResolvedValue(null), // no duplicate
        create: jest.fn().mockReturnValue({
          id: 'a1',
          status: ApplicationStatus.APPLIED,
          created_at: new Date(),
        }),
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockManager.getRepository.mockImplementation((entity: any) => {
        if (entity === JobListing) return txJobRepo;
        if (entity === Resume) return txResumeRepo;
        if (entity === JobApplication) return txAppRepo;
      });

      const result = await service.apply('u1', {
        job_id: 'j1',
        resume_id: 'r1',
      });

      expect(result.id).toBe('a1');
      expect(result.status).toBe(ApplicationStatus.APPLIED);
    });

    it('should throw NotFoundException if job not found or not ACTIVE', async () => {
      const txJobRepo = { findOne: jest.fn().mockResolvedValue(null) };
      mockManager.getRepository.mockReturnValue(txJobRepo);

      await expect(
        service.apply('u1', { job_id: 'bad', resume_id: 'r1' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if resume does not belong to user', async () => {
      const txJobRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'j1',
          company: { id: 'c1' },
          application_deadline: null,
        }),
      };
      const txResumeRepo = {
        findOne: jest.fn().mockResolvedValue(null), // resume not found for this user
      };
      mockManager.getRepository.mockImplementation((entity: any) => {
        if (entity === JobListing) return txJobRepo;
        if (entity === Resume) return txResumeRepo;
        return {};
      });

      await expect(
        service.apply('u1', { job_id: 'j1', resume_id: 'stolen' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw BadRequestException on duplicate application', async () => {
      const txJobRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'j1',
          company: { id: 'c1' },
          application_deadline: null,
        }),
      };
      const txResumeRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'r1' }),
      };
      const txAppRepo = {
        findOne: jest.fn().mockResolvedValue({ id: 'existing' }),
      };
      mockManager.getRepository.mockImplementation((entity: any) => {
        if (entity === JobListing) return txJobRepo;
        if (entity === Resume) return txResumeRepo;
        if (entity === JobApplication) return txAppRepo;
      });

      await expect(
        service.apply('u1', { job_id: 'j1', resume_id: 'r1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if deadline has passed', async () => {
      const txJobRepo = {
        findOne: jest.fn().mockResolvedValue({
          id: 'j1',
          company: { id: 'c1' },
          application_deadline: new Date('2020-01-01'), // past date
        }),
      };
      mockManager.getRepository.mockImplementation((entity: any) => {
        if (entity === JobListing) return txJobRepo;
        return {};
      });

      await expect(
        service.apply('u1', { job_id: 'j1', resume_id: 'r1' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ─── withdraw ─── */

  describe('withdraw', () => {
    it('should withdraw an application', async () => {
      const app = {
        id: 'a1',
        status: ApplicationStatus.APPLIED,
      };
      mockAppRepo.findOne.mockResolvedValue(app);
      mockAppRepo.save.mockResolvedValue(undefined);

      const result = await service.withdraw('u1', 'a1');

      expect(result.message).toContain('withdrawn');
      expect(app.status).toBe(ApplicationStatus.WITHDRAWN);
    });

    it('should throw NotFoundException if application not found', async () => {
      mockAppRepo.findOne.mockResolvedValue(null);

      await expect(service.withdraw('u1', 'bad')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if already ACCEPTED', async () => {
      mockAppRepo.findOne.mockResolvedValue({
        id: 'a1',
        status: ApplicationStatus.ACCEPTED,
      });

      await expect(service.withdraw('u1', 'a1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if already WITHDRAWN', async () => {
      mockAppRepo.findOne.mockResolvedValue({
        id: 'a1',
        status: ApplicationStatus.WITHDRAWN,
      });

      await expect(service.withdraw('u1', 'a1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  /* ─── getCandidateApplications ─── */

  describe('getCandidateApplications', () => {
    it('should return paginated applications with joined data', async () => {
      mockAppRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'a1',
            status: 'APPLIED',
            answers_json: null,
            video_url: null,
            created_at: new Date(),
            updated_at: new Date(),
            job: { id: 'j1', title: 'Dev', company: { name: 'Acme' } },
            comments: [
              { id: 'cm1', comment: 'Good', visible_to_candidate: true, created_at: new Date() },
              { id: 'cm2', comment: 'Internal', visible_to_candidate: false, created_at: new Date() },
            ],
          },
        ],
        1,
      ]);

      const result = await service.getCandidateApplications('u1', 1, 10);

      expect(result.meta.total).toBe(1);
      /* Only visible comments returned */
      expect(result.data[0].comments).toHaveLength(1);
      expect(result.data[0].comments[0].comment).toBe('Good');
    });
  });

  /* ─── getCompanyApplications ─── */

  describe('getCompanyApplications', () => {
    it('should return paginated applications for company', async () => {
      mockAppRepo.findAndCount.mockResolvedValue([
        [
          {
            id: 'a1',
            status: 'APPLIED',
            user: { email: 'c@t.com' },
            job: { title: 'Dev' },
            resume: { file_url: 'https://example.com/cv.pdf' },
            comments: [],
            created_at: new Date(),
            updated_at: new Date(),
          },
        ],
        1,
      ]);

      const result = await service.getCompanyApplications('c1', 1, 10);

      expect(result.meta.total).toBe(1);
      expect(result.data[0].candidate_email).toBe('c@t.com');
    });
  });

  /* ─── updateStatus ─── */

  describe('updateStatus', () => {
    it('should update application status', async () => {
      const app = { id: 'a1', status: ApplicationStatus.APPLIED };
      mockAppRepo.findOne.mockResolvedValue(app);
      mockAppRepo.save.mockResolvedValue(undefined);

      const result = await service.updateStatus('c1', 'a1', 'ACCEPTED', 'u1');

      expect(result.status).toBe('ACCEPTED');
    });

    it('should throw NotFoundException if not found', async () => {
      mockAppRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('c1', 'bad', 'ACCEPTED', 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if WITHDRAWN', async () => {
      mockAppRepo.findOne.mockResolvedValue({
        id: 'a1',
        status: ApplicationStatus.WITHDRAWN,
      });

      await expect(
        service.updateStatus('c1', 'a1', 'ACCEPTED', 'u1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ─── addComment ─── */

  describe('addComment', () => {
    it('should add a comment to an application', async () => {
      mockAppRepo.findOne.mockResolvedValue({ id: 'a1' });
      mockCommentRepo.create.mockReturnValue({
        id: 'cm1',
        comment: 'Looks good',
        visible_to_candidate: true,
        created_at: new Date(),
      });
      mockCommentRepo.save.mockResolvedValue(undefined);

      const result = await service.addComment('c1', 'a1', 'u1', {
        comment: 'Looks good',
        visible_to_candidate: true,
      });

      expect(result.comment).toBe('Looks good');
      expect(result.visible_to_candidate).toBe(true);
    });

    it('should throw NotFoundException if application not found', async () => {
      mockAppRepo.findOne.mockResolvedValue(null);

      await expect(
        service.addComment('c1', 'bad', 'u1', {
          comment: 'x',
          visible_to_candidate: false,
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  /* ─── getComments ─── */

  describe('getComments', () => {
    it('should return comments with user email', async () => {
      mockCommentRepo.find.mockResolvedValue([
        {
          id: 'cm1',
          comment: 'Nice',
          visible_to_candidate: true,
          user: { email: 'admin@co.com' },
          created_at: new Date(),
        },
      ]);

      const result = await service.getComments('c1', 'a1');

      expect(result).toHaveLength(1);
      expect(result[0].user_email).toBe('admin@co.com');
    });
  });
});
