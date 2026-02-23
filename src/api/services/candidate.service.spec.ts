/*
  Unit Tests — CandidateService.

  Tests profile creation, retrieval, and update
  with mocked TypeORM repository.
*/
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CandidateService } from './candidate.service';
import { CandidateProfile } from 'src/db/entities/candidate-profile.entity';

describe('CandidateService', () => {
  let service: CandidateService;

  const mockProfileRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CandidateService,
        { provide: getRepositoryToken(CandidateProfile), useValue: mockProfileRepo },
      ],
    }).compile();

    service = module.get<CandidateService>(CandidateService);
    jest.clearAllMocks();
  });

  /* ─── createProfile ─── */

  describe('createProfile', () => {
    it('should create a new profile', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);
      const profile = { id: 'p1', full_name: 'John' };
      mockProfileRepo.create.mockReturnValue(profile);
      mockProfileRepo.save.mockResolvedValue(undefined);

      const result = await service.createProfile('u1', {
        full_name: 'John',
        phone: '123',
      });

      expect(result.full_name).toBe('John');
      expect(mockProfileRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if profile already exists', async () => {
      mockProfileRepo.findOne.mockResolvedValue({ id: 'p1' });

      await expect(
        service.createProfile('u1', { full_name: 'John' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ─── getMyProfile ─── */

  describe('getMyProfile', () => {
    it('should return profile if found', async () => {
      const profile = { id: 'p1', full_name: 'John' };
      mockProfileRepo.findOne.mockResolvedValue(profile);

      const result = await service.getMyProfile('u1');
      expect(result).toEqual(profile);
    });

    it('should throw NotFoundException if not found', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await expect(service.getMyProfile('u1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ─── updateProfile ─── */

  describe('updateProfile', () => {
    it('should update and return profile', async () => {
      const profile = { id: 'p1', full_name: 'John', bio: 'old' };
      mockProfileRepo.findOne.mockResolvedValue(profile);
      mockProfileRepo.save.mockResolvedValue(undefined);

      const result = await service.updateProfile('u1', { bio: 'new bio' });

      expect(profile.bio).toBe('new bio');
      expect(mockProfileRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if profile not found', async () => {
      mockProfileRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateProfile('u1', { bio: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
