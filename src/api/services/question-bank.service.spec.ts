/*
  Unit Tests — QuestionBankService.

  Tests CRUD operations for question banks
  with mocked TypeORM repository.
*/
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { QuestionBankService } from './question-bank.service';
import { QuestionBank } from 'src/db/entities/question-bank.entity';

describe('QuestionBankService', () => {
  let service: QuestionBankService;

  const mockQbRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QuestionBankService,
        { provide: getRepositoryToken(QuestionBank), useValue: mockQbRepo },
      ],
    }).compile();

    service = module.get<QuestionBankService>(QuestionBankService);
    jest.clearAllMocks();
  });

  /* ─── create ─── */

  describe('create', () => {
    it('should create and return a question bank', async () => {
      const created = {
        id: 'qb1',
        name: 'Screening v1',
        questions_json: [{ id: 'q1', question: 'Test?', type: 'text', is_required: true }],
        created_at: new Date(),
      };
      mockQbRepo.create.mockReturnValue(created);
      mockQbRepo.save.mockResolvedValue(undefined);

      const result = await service.create('c1', 'u1', {
        name: 'Screening v1',
        questions_json: [{ id: 'q1', question: 'Test?', type: 'text', is_required: true }],
      });

      expect(result.id).toBe('qb1');
      expect(result.name).toBe('Screening v1');
      expect(mockQbRepo.save).toHaveBeenCalled();
    });
  });

  /* ─── findAll ─── */

  describe('findAll', () => {
    it('should return paginated question banks', async () => {
      mockQbRepo.findAndCount.mockResolvedValue([
        [{ id: 'qb1', name: 'Test QB' }],
        1,
      ]);

      const result = await service.findAll('c1', 1, 10);

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
    });
  });

  /* ─── findOne ─── */

  describe('findOne', () => {
    it('should return question bank if found', async () => {
      const qb = { id: 'qb1', name: 'Test' };
      mockQbRepo.findOne.mockResolvedValue(qb);

      const result = await service.findOne('c1', 'qb1');
      expect(result).toEqual(qb);
    });

    it('should throw NotFoundException if not found', async () => {
      mockQbRepo.findOne.mockResolvedValue(null);

      await expect(service.findOne('c1', 'bad')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ─── update ─── */

  describe('update', () => {
    it('should update and return question bank', async () => {
      const qb = { id: 'qb1', name: 'Old Name', questions_json: [] };
      mockQbRepo.findOne.mockResolvedValue(qb);
      mockQbRepo.save.mockResolvedValue(undefined);

      const result = await service.update('c1', 'qb1', {
        name: 'New Name',
      });

      expect(qb.name).toBe('New Name');
      expect(mockQbRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if question bank not found', async () => {
      mockQbRepo.findOne.mockResolvedValue(null);

      await expect(
        service.update('c1', 'bad', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
