// Resume Controller — upload, list, download, set primary, delete.

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
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ResumeService } from '../services/resume.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { PaginationSchema } from 'src/zod/pagination.zod';
import type { PaginationDto } from 'src/zod/pagination.zod';

@Controller('v1/candidate/resumes')
export class ResumeController {
  constructor(private readonly resumeService: ResumeService) {}

  // POST /api/v1/candidate/resumes — multipart upload
  @UseGuards(JwtAuthGuard)
  @Post()
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Req() req,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { title?: string; is_primary?: string },
  ) {
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const isPrimary = body.is_primary === 'true';
    return this.resumeService.create(req.user.id, file, body.title, isPrimary);
  }

  // GET /api/v1/candidate/resumes — paginated list
  @UseGuards(JwtAuthGuard)
  @Get()
  async findAll(
    @Req() req,
    @Query(new ZodValidationPipe(PaginationSchema)) query: PaginationDto,
  ) {
    return this.resumeService.findAll(req.user.id, query.page, query.limit);
  }

  // GET /api/v1/candidate/resumes/:resumeId/download — signed URL (15 min)
  @UseGuards(JwtAuthGuard)
  @Get(':resumeId/download')
  async download(
    @Req() req,
    @Param('resumeId') resumeId: string,
  ) {
    const resume = await this.resumeService.findOneByUserAndId(
      req.user.id,
      resumeId,
    );

    if (!resume) {
      throw new NotFoundException('Resume not found');
    }

    const signedUrl = await this.resumeService.getDownloadUrl(resume.storage_key);

    return {
      download_url: signedUrl,
      filename: resume.original_filename,
      mime_type: resume.mime_type,
      expires_in: 900,
    };
  }

  // PATCH /api/v1/candidate/resumes/:resumeId/primary
  @UseGuards(JwtAuthGuard)
  @Patch(':resumeId/primary')
  async setPrimary(
    @Req() req,
    @Param('resumeId') resumeId: string,
  ) {
    return this.resumeService.setPrimary(req.user.id, resumeId);
  }

  // DELETE /api/v1/candidate/resumes/:resumeId
  @UseGuards(JwtAuthGuard)
  @Delete(':resumeId')
  async delete(
    @Req() req,
    @Param('resumeId') resumeId: string,
  ) {
    return this.resumeService.delete(req.user.id, resumeId);
  }
}
