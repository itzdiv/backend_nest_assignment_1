/*
  Candidate Service.

  Handles all business logic for candidate profile management:
  - Creating a candidate profile (one-to-one with User)
  - Getting the authenticated user's profile
  - Updating the profile

  Each user can have at most ONE candidate profile.
*/

/*
  Injectable — marks class as NestJS provider.
  BadRequestException — HTTP 400 (duplicate profile).
  NotFoundException — HTTP 404 (profile not found).
*/
import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

/*
  InjectRepository — injects TypeORM repository.
  Repository — generic TypeORM CRUD repository.
*/
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

/* Entity class for candidate_profiles table */
import { CandidateProfile } from 'src/db/entities/candidate-profile.entity';

/* Zod DTO types */
import {
  CreateCandidateProfileDto,
  UpdateCandidateProfileDto,
} from 'src/zod/candidate.zod';

@Injectable()
export class CandidateService {
  constructor(
    /* Inject CandidateProfile repository for DB operations */
    @InjectRepository(CandidateProfile)
    private readonly profileRepository: Repository<CandidateProfile>,
  ) {}

  /*
    createProfile — creates a candidate profile for the user.

    OneToOne constraint: each user can have at most one profile.
    If profile already exists, throws BadRequestException.

    @param userId — UUID of the authenticated user.
    @param dto    — validated request body with profile fields.
    @returns created profile entity.
  */
  async createProfile(userId: string, dto: CreateCandidateProfileDto) {
    /* Check if user already has a profile */
    const existing = await this.profileRepository.findOne({
      where: { user: { id: userId } },
    });

    if (existing) {
      throw new BadRequestException(
        'Candidate profile already exists. Use PATCH to update.',
      );
    }

    /* Create and save profile */
    const profile = this.profileRepository.create({
      user: { id: userId } as any,
      full_name: dto.full_name,
      bio: dto.bio,
      photo_url: dto.photo_url,
      linkedin_url: dto.linkedin_url,
      portfolio_url: dto.portfolio_url,
      phone: dto.phone,
    });

    await this.profileRepository.save(profile);

    return profile;
  }

  /*
    getMyProfile — fetches the authenticated user's profile.

    @param userId — UUID of the authenticated user.
    @returns profile entity or throws 404.
  */
  async getMyProfile(userId: string) {
    const profile = await this.profileRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }

    return profile;
  }

  /*
    updateProfile — partially updates the profile.

    @param userId — UUID of the authenticated user.
    @param dto    — validated partial update body.
    @returns updated profile entity.
  */
  async updateProfile(userId: string, dto: UpdateCandidateProfileDto) {
    const profile = await this.profileRepository.findOne({
      where: { user: { id: userId } },
    });

    if (!profile) {
      throw new NotFoundException('Candidate profile not found');
    }

    /* Use TypeORM's merge() to update entity fields */
    this.profileRepository.merge(profile, dto);

    await this.profileRepository.save(profile);

    return profile;
  }
}
