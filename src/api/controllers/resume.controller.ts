/*
  Resume Controller.

  Handles HTTP requests for resume management.
  All routes scoped under /api/v1/candidate/resumes.

  These endpoints are user-scoped (not company-scoped).
  Only JwtAuthGuard is needed — no company membership required.
*/

/*
  NestJS decorators:
  @Controller — registers route handler with base path.
  @Post, @Get, @Patch, @Delete — HTTP method decorators.
  @UseGuards — applies guard middleware.
  @Body, @Param, @Query — parameter extraction decorators.
  @Req — injects raw Express request for user access.
*/
import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';

/* Service containing resume business logic */
import { ResumeService } from '../services/resume.service';

/* JWT guard — ensures the user is authenticated */
import { JwtAuthGuard } from '../guards/jwt-auth.guard';

/* Zod validation pipe */
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/* Zod schemas — runtime values used by ZodValidationPipe */
import { CreateResumeSchema } from 'src/zod/candidate.zod';
import { PaginationSchema } from 'src/zod/pagination.zod';

/* DTO types — type-only imports (required by isolatedModules + emitDecoratorMetadata) */
import type { CreateResumeDto } from 'src/zod/candidate.zod';
import type { PaginationDto } from 'src/zod/pagination.zod';

/*
  Route: /api/v1/candidate/resumes
  Resume endpoints are user-scoped.
*/
@Controller('v1/candidate/resumes')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  /*
    POST /api/v1/candidate/resumes
    Upload a new resume.
    If is_primary = true, all other resumes are demoted.
  */
  @UseGuards(JwtAuthGuard)
  @Post()
  async create(
    @Req() req,
    @Body(new ZodValidationPipe(CreateResumeSchema))
    body: CreateResumeDto,
  ) {
    return this.resumeService.create(req.user.id, body);
  }

  /*
    GET /api/v1/candidate/resumes
    List all resumes for the authenticated user.
    Supports pagination via ?page=1&limit=10.
  */
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Req() req,
    @Query(new ZodValidationPipe(PaginationSchema))
    query: PaginationDto,
  ) {
    return this.resumeService.findAll(
      req.user.id,
      query.page,
      query.limit,
    );
  }

  /*
    PATCH /api/v1/candidate/resumes/:resumeId/primary
    Set a specific resume as the primary one.
    All other resumes for the user are demoted.
  */
  @UseGuards(JwtAuthGuard)
  @Patch(':resumeId/primary')
  async setPrimary(
    @Req() req,
    @Param('resumeId') resumeId: string,
  ) {
    return this.resumeService.setPrimary(req.user.id, resumeId);
  }

  /*
    DELETE /api/v1/candidate/resumes/:resumeId
    Delete a resume.
    Validates ownership before deletion.
  */
  @UseGuards(JwtAuthGuard)
  @Delete(':resumeId')
  async delete(
    @Req() req,
    @Param('resumeId') resumeId: string,
  ) {
    return this.resumeService.delete(req.user.id, resumeId);
  }
}
