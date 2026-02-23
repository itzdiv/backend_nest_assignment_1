/*
  Candidate Controller.

  Handles HTTP requests for candidate profile management.
  All routes scoped under /api/v1/candidate/profile.

  These endpoints are user-scoped (not company-scoped).
  Only JwtAuthGuard is needed — no company membership required.
*/

/*
  NestJS decorators:
  @Controller — registers route handler with base path.
  @Post, @Get, @Patch — HTTP method decorators.
  @UseGuards — applies guard middleware.
  @Body — extracts validated request body.
  @Req — injects raw Express request for user access.
*/
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';

/* Service containing candidate profile business logic */
import { CandidateService } from '../services/candidate.service';

/* JWT guard — ensures the user is authenticated */
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/* Zod validation pipe */
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/* Zod schemas — runtime values used by ZodValidationPipe */
import {
  CreateCandidateProfileSchema,
  UpdateCandidateProfileSchema,
} from 'src/zod/candidate.zod';

/* DTO types — type-only imports (required by isolatedModules + emitDecoratorMetadata) */
import type {
  CreateCandidateProfileDto,
  UpdateCandidateProfileDto,
} from 'src/zod/candidate.zod';

/*
  Route: /api/v1/candidate/profile
  Candidate profile endpoints are user-scoped.
*/
@Controller('v1/candidate/profile')
export class CandidateController {
  constructor(private readonly candidateService: CandidateService) {}

  /*
    POST /api/v1/candidate/profile
    Create a candidate profile for the authenticated user.
    Each user can have at most ONE profile.
  */
  @UseGuards(JwtAuthGuard)
  @Post()
  async createProfile(
    @Req() req,
    @Body(new ZodValidationPipe(CreateCandidateProfileSchema))
    body: CreateCandidateProfileDto,
  ) {
    return this.candidateService.createProfile(req.user.id, body);
  }

  /*
    GET /api/v1/candidate/profile
    Get the authenticated user's candidate profile.
  */
  @UseGuards(JwtAuthGuard)
  @Get()
  async getMyProfile(@Req() req) {
    return this.candidateService.getMyProfile(req.user.id);
  }

  /*
    PATCH /api/v1/candidate/profile
    Update the authenticated user's candidate profile.
    Partial update — only send fields you want to change.
  */
  @UseGuards(JwtAuthGuard)
  @Patch()
  async updateProfile(
    @Req() req,
    @Body(new ZodValidationPipe(UpdateCandidateProfileSchema))
    body: UpdateCandidateProfileDto,
  ) {
    return this.candidateService.updateProfile(req.user.id, body);
  }
}
