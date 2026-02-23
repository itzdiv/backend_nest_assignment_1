/*
  Unit Tests — MemberService.

  Tests invite, list, update role, revoke, and
  transfer ownership logic with mocked repos.
*/
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { MemberService } from './member.service';
import { CompanyMember } from 'src/db/entities/company-member.entity';
import { User } from 'src/db/entities/user.entity';
import { CompanyRole, MemberStatus } from 'src/db/enums';
import { DataSource } from 'typeorm';

describe('MemberService', () => {
  let service: MemberService;

  const mockMemberRepo = {
    findOne: jest.fn(),
    findAndCount: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    count: jest.fn(),
  };

  const mockUserRepo = {
    findOne: jest.fn(),
  };

  const mockManager = { getRepository: jest.fn() };
  const mockDataSource = {
    transaction: jest.fn((cb: any) => cb(mockManager)),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemberService,
        { provide: getRepositoryToken(CompanyMember), useValue: mockMemberRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<MemberService>(MemberService);
    jest.clearAllMocks();
  });

  /* ─── inviteMember ─── */

  describe('inviteMember', () => {
    it('should invite a user successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'u2', email: 't@t.com' });
      mockMemberRepo.findOne.mockResolvedValue(null); // not already member
      mockMemberRepo.create.mockReturnValue({
        id: 'm1',
        role: CompanyRole.RECRUITER,
        status: MemberStatus.INVITED,
      });
      mockMemberRepo.save.mockResolvedValue(undefined);

      const result = await service.inviteMember('c1', {
        email: 't@t.com',
        role: 'RECRUITER',
      }, 'u1');

      expect(result.status).toBe(MemberStatus.INVITED);
    });

    it('should throw NotFoundException if invitee email not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.inviteMember('c1', { email: 'no@one.com', role: 'RECRUITER' }, 'u1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if user already a member', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: 'u2' });
      mockMemberRepo.findOne.mockResolvedValue({ id: 'existing' });

      await expect(
        service.inviteMember('c1', { email: 'dup@t.com', role: 'ADMIN' }, 'u1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ─── listMembers ─── */

  describe('listMembers', () => {
    it('should return paginated member list', async () => {
      mockMemberRepo.findAndCount.mockResolvedValue([
        [
          { id: 'm1', role: 'OWNER', status: 'ACTIVE', user: { email: 'a@b.com' }, created_at: new Date() },
        ],
        1,
      ]);

      const result = await service.listMembers('c1', 1, 10);

      expect(result.meta.total).toBe(1);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].email).toBe('a@b.com');
    });
  });

  /* ─── updateMemberRole ─── */

  describe('updateMemberRole', () => {
    it('should update role successfully', async () => {
      const membership = { id: 'm1', role: CompanyRole.RECRUITER, status: MemberStatus.ACTIVE };
      mockMemberRepo.findOne.mockResolvedValue(membership);
      mockMemberRepo.save.mockResolvedValue(undefined);

      const result = await service.updateMemberRole('c1', 'm1', { role: 'ADMIN' });

      expect(result.role).toBe('ADMIN');
    });

    it('should throw NotFoundException if membership not found', async () => {
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(
        service.updateMemberRole('c1', 'bad', { role: 'ADMIN' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should prevent downgrading the last OWNER', async () => {
      const membership = { id: 'm1', role: CompanyRole.OWNER, status: MemberStatus.ACTIVE };
      mockMemberRepo.findOne.mockResolvedValue(membership);
      mockMemberRepo.count.mockResolvedValue(1); // only 1 OWNER

      await expect(
        service.updateMemberRole('c1', 'm1', { role: 'ADMIN' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ─── revokeMember ─── */

  describe('revokeMember', () => {
    it('should revoke a member', async () => {
      const membership = {
        id: 'm1',
        role: CompanyRole.RECRUITER,
        status: MemberStatus.ACTIVE,
      };
      mockMemberRepo.findOne.mockResolvedValue(membership);
      mockMemberRepo.save.mockResolvedValue(undefined);

      const result = await service.revokeMember('c1', 'm1');

      expect(result.message).toContain('revoked');
      expect(membership.status).toBe(MemberStatus.REVOKED);
    });

    it('should throw NotFoundException if membership not found', async () => {
      mockMemberRepo.findOne.mockResolvedValue(null);

      await expect(service.revokeMember('c1', 'bad')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should prevent revoking the last OWNER', async () => {
      const membership = { id: 'm1', role: CompanyRole.OWNER, status: MemberStatus.ACTIVE };
      mockMemberRepo.findOne.mockResolvedValue(membership);
      mockMemberRepo.count.mockResolvedValue(1);

      await expect(service.revokeMember('c1', 'm1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  /* ─── transferOwnership ─── */

  describe('transferOwnership', () => {
    it('should transfer ownership in a transaction', async () => {
      const currentMember = { id: 'm1', role: CompanyRole.OWNER, status: MemberStatus.ACTIVE };
      const targetMember = { id: 'm2', role: CompanyRole.ADMIN, status: MemberStatus.ACTIVE };

      const txMemberRepo = {
        findOne: jest.fn()
          .mockResolvedValueOnce(currentMember)  // current OWNER
          .mockResolvedValueOnce(targetMember),   // target
        save: jest.fn().mockResolvedValue(undefined),
      };

      mockManager.getRepository.mockReturnValue(txMemberRepo);

      const result = await service.transferOwnership('c1', 'm2', 'user-1');

      expect(result.message).toContain('transferred');
      expect(targetMember.role).toBe(CompanyRole.OWNER);
      expect(currentMember.role).toBe(CompanyRole.ADMIN);
    });

    it('should throw ForbiddenException if user is not OWNER', async () => {
      const txMemberRepo = {
        findOne: jest.fn().mockResolvedValue(null), // no OWNER match
      };
      mockManager.getRepository.mockReturnValue(txMemberRepo);

      await expect(
        service.transferOwnership('c1', 'm2', 'non-owner'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw NotFoundException if target member not found', async () => {
      const currentMember = { id: 'm1', role: CompanyRole.OWNER };
      const txMemberRepo = {
        findOne: jest.fn()
          .mockResolvedValueOnce(currentMember)
          .mockResolvedValueOnce(null), // target not found
        save: jest.fn(),
      };
      mockManager.getRepository.mockReturnValue(txMemberRepo);

      await expect(
        service.transferOwnership('c1', 'bad-id', 'user-1'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
