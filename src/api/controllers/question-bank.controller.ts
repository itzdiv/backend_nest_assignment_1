/*
  Question Bank Controller.

  Handles HTTP requests for question bank management.
  All routes scoped under /api/v1/companies/:companyId/question-banks.

  Guards applied:
  - JwtAuthGuard: ensures user is authenticated.
  - CompanyMembershipGuard: ensures user belongs to this company.
  - RoleGuard: ensures user has sufficient role (all roles can manage QBs).
*/

/*
  NestJS decorators for controller setup:
  @Controller — registers route handler with base path.
  @Post, @Get, @Patch — HTTP method decorators.
  @UseGuards — applies guard middleware in order.
  @Body — extracts validated request body.
  @Param — extracts URL path parameters.
  @Query — extracts query string parameters.
  @Req — injects raw Express request for user access.
*/
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';

/* Service containing question bank business logic */
import { QuestionBankService } from '../services/question-bank.service';

/* Guards for authentication and authorization */
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CompanyMembershipGuard } from '../guards/company-membership.guard';
import { RoleGuard } from '../guards/role.guard';

/* Zod validation pipe — validates request body/query against schema */
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/* Roles decorator — declares which roles can access a route */
import { Roles } from '../decorators/roles.decorator';

/* Zod schemas — runtime values used by ZodValidationPipe */
import {
  CreateQuestionBankSchema,
  UpdateQuestionBankSchema,
} from 'src/zod/job.zod';
import { PaginationSchema } from 'src/zod/pagination.zod';

/* DTO types — type-only imports (required by isolatedModules + emitDecoratorMetadata) */
import type { CreateQuestionBankDto, UpdateQuestionBankDto } from 'src/zod/job.zod';
import type { PaginationDto } from 'src/zod/pagination.zod';

/*
  Route: /api/v1/companies/:companyId/question-banks
  All question bank routes are nested under a company.
*/
@Controller('v1/companies/:companyId/question-banks')
export class QuestionBankController {
  constructor(
    private readonly qbService: QuestionBankService,
  ) {}

  /*
    POST /api/v1/companies/:companyId/question-banks
    Create a new question bank.
    All company roles (OWNER, ADMIN, RECRUITER) can create.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN', 'RECRUITER')
  @Post()
  async create(
    @Param('companyId') companyId: string,
    @Req() req,
    @Body(new ZodValidationPipe(CreateQuestionBankSchema))
    body: CreateQuestionBankDto,
  ) {
    return this.qbService.create(companyId, req.user.id, body);
  }

  /*
    GET /api/v1/companies/:companyId/question-banks
    List all question banks for this company with pagination.
    All company members can view.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard)
  @Get()
  async findAll(
    @Param('companyId') companyId: string,
    @Query(new ZodValidationPipe(PaginationSchema))
    query: PaginationDto,
  ) {
    return this.qbService.findAll(companyId, query.page, query.limit);
  }

  /*
    GET /api/v1/companies/:companyId/question-banks/:qbId
    Get single question bank details.
    All company members can view.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard)
  @Get(':qbId')
  async findOne(
    @Param('companyId') companyId: string,
    @Param('qbId') qbId: string,
  ) {
    return this.qbService.findOne(companyId, qbId);
  }

  /*
    PATCH /api/v1/companies/:companyId/question-banks/:qbId
    Update a question bank.
    All company roles can update.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN', 'RECRUITER')
  @Patch(':qbId')
  async update(
    @Param('companyId') companyId: string,
    @Param('qbId') qbId: string,
    @Body(new ZodValidationPipe(UpdateQuestionBankSchema))
    body: UpdateQuestionBankDto,
  ) {
    return this.qbService.update(companyId, qbId, body);
  }
}
