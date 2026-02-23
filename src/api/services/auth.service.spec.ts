/*
  Unit Tests — AuthService.

  Tests registration and login logic with mocked
  TypeORM repository and bcrypt/jwt dependencies.
*/
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { User } from 'src/db/entities/user.entity';
import * as bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';

/* Mock bcrypt and jwt at module level */
jest.mock('bcrypt');
jest.mock('jsonwebtoken');

describe('AuthService', () => {
  let service: AuthService;

  /* Mock repository methods */
  const mockUserRepo = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepo,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();

    /* Set JWT_SECRET for tests */
    process.env.JWT_SECRET = 'test-secret';
  });

  /* ─── Registration ─── */

  describe('register', () => {
    it('should register a new user successfully', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);
      (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-pw');
      mockUserRepo.create.mockReturnValue({ email: 'a@b.com' });
      mockUserRepo.save.mockResolvedValue({ id: '1', email: 'a@b.com' });

      const result = await service.register({
        email: 'a@b.com',
        password: 'Pass1234',
      });

      expect(result).toEqual({ message: 'User Registered Sucessfully' });
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
      });
      expect(bcrypt.hash).toHaveBeenCalledWith('Pass1234', 10);
      expect(mockUserRepo.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException if email already registered', async () => {
      mockUserRepo.findOne.mockResolvedValue({ id: '1', email: 'a@b.com' });

      await expect(
        service.register({ email: 'a@b.com', password: 'Pass1234' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  /* ─── Login ─── */

  describe('login', () => {
    it('should return access token on valid credentials', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: 'user-1',
        email: 'a@b.com',
        password_hash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      (jwt.sign as jest.Mock).mockReturnValue('mock-token');

      const result = await service.login({
        email: 'a@b.com',
        password: 'Pass1234',
      });

      expect(result).toEqual({ acess_token: 'mock-token' });
      expect(jwt.sign).toHaveBeenCalledWith(
        { user_id: 'user-1' },
        'test-secret',
        { expiresIn: '7d' },
      );
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUserRepo.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@b.com', password: 'x' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if password wrong', async () => {
      mockUserRepo.findOne.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
        password_hash: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@b.com', password: 'wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });
});
