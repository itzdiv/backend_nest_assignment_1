/*
  Unit Tests — ResumeService.

  Tests resume creation (with primary switching),
  listing, primary setting, and deletion
  with mocked TypeORM repository.
*/
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ResumeService } from './resume.service';
import { Resume } from 'src/db/entities/resume.entity';
import { DataSource } from 'typeorm';

describe('ResumeService', () => {
  let service: ResumeService;

  const mockResumeRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  /* Transaction mock */
  const mockManager = { getRepository: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn((cb: any) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResumeService,
        { provide: getRepositoryToken(Resume), useValue: mockResumeRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<ResumeService>(ResumeService);
    jest.clearAllMocks();
  });

  /* ─── create ─── */

  describe('create', () => {
    it('should create a non-primary resume without transaction', async () => {
      const resume = { id: 'r1', title: 'CV', is_primary: false };
      mockResumeRepo.create.mockReturnValue(resume);
      mockResumeRepo.save.mockResolvedValue(undefined);

      const result = await service.create('u1', {
        title: 'CV',
        file_url: 'https://example.com/cv.pdf',
        is_primary: false,
      });

      expect(result).toEqual(resume);
      /* Should NOT use transaction for non-primary */
      expect(mockDataSource.transaction).not.toHaveBeenCalled();
    });

    it('should create a primary resume inside transaction', async () => {
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      const txResumeRepo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        create: jest.fn().mockReturnValue({
          id: 'r2',
          title: 'Main',
          is_primary: true,
        }),
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockManager.getRepository.mockReturnValue(txResumeRepo);

      const result = await service.create('u1', {
        title: 'Main',
        file_url: 'https://example.com/main.pdf',
        is_primary: true,
      });

      expect(result.is_primary).toBe(true);
      expect(mockDataSource.transaction).toHaveBeenCalled();
      /* Verify demotion query was executed */
      expect(qb.execute).toHaveBeenCalled();
    });
  });

  /* ─── findAll ─── */

  describe('findAll', () => {
    it('should return paginated resume list', async () => {
      mockResumeRepo.findAndCount.mockResolvedValue([
        [{ id: 'r1', title: 'CV' }],
        1,
      ]);

      const result = await service.findAll('u1', 1, 10);

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  /* ─── setPrimary ─── */

  describe('setPrimary', () => {
    it('should set resume as primary in transaction', async () => {
      const resume = { id: 'r1', is_primary: false };
      const qb = {
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue(undefined),
      };
      const txResumeRepo = {
        findOne: jest.fn().mockResolvedValue(resume),
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        save: jest.fn().mockResolvedValue(undefined),
      };
      mockManager.getRepository.mockReturnValue(txResumeRepo);

      const result = await service.setPrimary('u1', 'r1');

      expect(resume.is_primary).toBe(true);
    });

    it('should throw NotFoundException if resume not found', async () => {
      const txResumeRepo = {
        findOne: jest.fn().mockResolvedValue(null),
      };
      mockManager.getRepository.mockReturnValue(txResumeRepo);

      await expect(service.setPrimary('u1', 'bad')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ─── delete ─── */

  describe('delete', () => {
    it('should delete resume successfully', async () => {
      const resume = { id: 'r1' };
      mockResumeRepo.findOne.mockResolvedValue(resume);
      mockResumeRepo.remove.mockResolvedValue(undefined);

      const result = await service.delete('u1', 'r1');

      expect(result.message).toContain('deleted');
    });

    it('should throw NotFoundException if resume not found', async () => {
      mockResumeRepo.findOne.mockResolvedValue(null);

      await expect(service.delete('u1', 'bad')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ConflictException on FK violation', async () => {
      const resume = { id: 'r1' };
      mockResumeRepo.findOne.mockResolvedValue(resume);
      mockResumeRepo.remove.mockRejectedValue({ code: '23503' });

      await expect(service.delete('u1', 'r1')).rejects.toThrow(
        ConflictException,
      );
    });
  });
});
