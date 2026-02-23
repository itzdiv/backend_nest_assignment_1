/*
  Unit Tests — CompanyService.

  Tests company creation (with OWNER membership),
  fetching, and updating logic with mocked repos.
*/
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CompanyService } from './company.service';
import { Company } from 'src/db/entities/company.entity';
import { CompanyMember } from 'src/db/entities/company-member.entity';
import { CompanyRole, MemberStatus } from 'src/db/enums';
import { DataSource, IsNull } from 'typeorm';

describe('CompanyService', () => {
  let service: CompanyService;

  const mockCompanyRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };
  const mockMemberRepo = {
    create: jest.fn(),
    save: jest.fn(),
  };

  /* Transaction mock — simulates DataSource.transaction */
  const mockManager = {
    getRepository: jest.fn(),
  };
  const mockDataSource = {
    transaction: jest.fn((cb: any) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CompanyService,
        { provide: getRepositoryToken(Company), useValue: mockCompanyRepo },
        { provide: getRepositoryToken(CompanyMember), useValue: mockMemberRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<CompanyService>(CompanyService);
    jest.clearAllMocks();
  });

  /* ─── createCompany ─── */

  describe('createCompany', () => {
    it('should create company and OWNER membership in a transaction', async () => {
      const txCompanyRepo = {
        create: jest.fn().mockReturnValue({
          id: 'c1',
          name: 'Acme',
          created_at: new Date(),
        }),
        save: jest.fn().mockResolvedValue(undefined),
      };
      const txMemberRepo = {
        create: jest.fn().mockReturnValue({ id: 'm1' }),
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockManager.getRepository.mockImplementation((entity: any) => {
        if (entity === Company) return txCompanyRepo;
        if (entity === CompanyMember) return txMemberRepo;
      });

      const result = await service.createCompany(
        { name: 'Acme', description: 'A company' },
        'user-1',
      );

      /* Verify company was created */
      expect(txCompanyRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Acme' }),
      );
      expect(txCompanyRepo.save).toHaveBeenCalled();

      /* Verify OWNER membership was created */
      expect(txMemberRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          role: CompanyRole.OWNER,
          status: MemberStatus.ACTIVE,
        }),
      );
      expect(txMemberRepo.save).toHaveBeenCalled();

      /* Verify returned shape */
      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('name', 'Acme');
    });
  });

  /* ─── getCompanyById ─── */

  describe('getCompanyById', () => {
    it('should return company if found', async () => {
      const company = { id: 'c1', name: 'Acme', deleted_at: null };
      mockCompanyRepo.findOne.mockResolvedValue(company);

      const result = await service.getCompanyById('c1');

      expect(result).toEqual(company);
    });

    it('should throw NotFoundException if not found', async () => {
      mockCompanyRepo.findOne.mockResolvedValue(null);

      await expect(service.getCompanyById('bad-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  /* ─── updateCompany ─── */

  describe('updateCompany', () => {
    it('should update and return company', async () => {
      const company = { id: 'c1', name: 'Old', description: 'old desc' };
      mockCompanyRepo.findOne.mockResolvedValue(company);
      mockCompanyRepo.save.mockResolvedValue({ ...company, name: 'New' });

      const result = await service.updateCompany('c1', { name: 'New' });

      expect(company.name).toBe('New');
      expect(mockCompanyRepo.save).toHaveBeenCalled();
    });

    it('should throw NotFoundException if company not found', async () => {
      mockCompanyRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateCompany('bad', { name: 'x' }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
