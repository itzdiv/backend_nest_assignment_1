// Resume Service — upload, list, primary toggle, delete, signed download URLs.

import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { randomUUID } from 'crypto';
import * as path from 'path';

import { Resume } from 'src/db/entities/resume.entity';
import { SupabaseStorageService } from './supabase-storage.service';
import { paginate } from 'src/libs/pagination';

const MAX_RESUMES_PER_USER = 10;

@Injectable()
export class ResumeService {
  constructor(
    @InjectRepository(Resume)
    private readonly resumeRepository: Repository<Resume>,
    private readonly dataSource: DataSource,
    private readonly storageService: SupabaseStorageService,
  ) {}

  // Upload file to Supabase Storage and create a resume record.
  // File type & size validation is handled by the Supabase bucket policy.
  async create(
    userId: string,
    file: Express.Multer.File,
    title?: string,
    isPrimary = false,
  ) {
    // Check resume limit
    const existingCount = await this.resumeRepository.count({
      where: { user: { id: userId } },
    });

    if (existingCount >= MAX_RESUMES_PER_USER) {
      throw new BadRequestException(
        `Maximum resume limit reached (${MAX_RESUMES_PER_USER})`,
      );
    }

    // Generate unique storage key
    const ext = path.extname(file.originalname) || '.pdf';
    const storageKey = `${userId}/${randomUUID()}${ext}`;

    // Upload to Supabase Storage (bucket validates type & size)
    try {
      await this.storageService.uploadFile(
        storageKey,
        file.buffer,
        file.mimetype,
      );
    } catch (err) {
      throw new InternalServerErrorException(
        'Failed to upload file to storage',
      );
    }

    // Insert DB row — if is_primary, demote others in a transaction
    try {
      if (isPrimary) {
        return await this.dataSource.transaction(async (manager) => {
          const resumeRepo = manager.getRepository(Resume);

          await resumeRepo
            .createQueryBuilder()
            .update(Resume)
            .set({ is_primary: false })
            .where('user_id = :userId', { userId })
            .andWhere('is_primary = true')
            .execute();

          const resume = resumeRepo.create({
            user: { id: userId } as any,
            title: title || file.originalname,
            storage_key: storageKey,
            original_filename: file.originalname,
            mime_type: file.mimetype,
            file_size_bytes: file.size,
            is_primary: true,
          });

          await resumeRepo.save(resume);
          return resume;
        });
      }

      const resume = this.resumeRepository.create({
        user: { id: userId } as any,
        title: title || file.originalname,
        storage_key: storageKey,
        original_filename: file.originalname,
        mime_type: file.mimetype,
        file_size_bytes: file.size,
        is_primary: false,
      });

      await this.resumeRepository.save(resume);
      return resume;
    } catch (err) {
      // If DB insert fails, clean up the uploaded file
      await this.storageService.deleteFile([storageKey]).catch(() => {});
      throw err;
    }
  }

  async findAll(userId: string, page: number, limit: number) {
    const [items, total] = await this.resumeRepository.findAndCount({
      where: { user: { id: userId } },
      order: { created_at: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });

    return paginate(items, total, page, limit);
  }

  async setPrimary(userId: string, resumeId: string) {
    return this.dataSource.transaction(async (manager) => {
      const resumeRepo = manager.getRepository(Resume);

      const resume = await resumeRepo.findOne({
        where: { id: resumeId, user: { id: userId } },
      });

      if (!resume) {
        throw new NotFoundException('Resume not found');
      }

      // Demote all, then promote selected
      await resumeRepo
        .createQueryBuilder()
        .update(Resume)
        .set({ is_primary: false })
        .where('user_id = :userId', { userId })
        .execute();

      resume.is_primary = true;
      await resumeRepo.save(resume);

      return resume;
    });
  }

  async delete(userId: string, resumeId: string) {
    const resume = await this.resumeRepository.findOne({
      where: { id: resumeId, user: { id: userId } },
    });

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    // Handle FK constraint violation (resume linked to applications)
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

    // Best-effort storage cleanup
    await this.storageService
      .deleteFile([resume.storage_key])
      .catch(() => {});

    return { message: 'Resume deleted successfully' };
  }

  // Generate a signed download URL (15-min TTL by default)
  async getDownloadUrl(storageKey: string, expiresIn = 900) {
    return this.storageService.getSignedUrl(storageKey, expiresIn);
  }

  async getResumeById(resumeId: string) {
    return this.resumeRepository.findOne({ where: { id: resumeId } });
  }

  async findOneByUserAndId(userId: string, resumeId: string) {
    return this.resumeRepository.findOne({
      where: { id: resumeId, user: { id: userId } },
    });
  }
}
