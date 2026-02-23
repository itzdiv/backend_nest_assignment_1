/*
  Controller — handles HTTP requests for company endpoints.

  NestJS decorators:
  @Controller — registers this class as a route handler.
  @Post, @Get, @Patch — HTTP method decorators.
  @UseGuards — applies guards (authentication, authorization).
  @Body — extracts request body.
  @Param — extracts URL parameters.
  @Req — injects raw Express request object.
*/
import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';

/* Service that contains all company business logic */
import { CompanyService } from '../services/company.service';

/* Guards for authentication and authorization */
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CompanyMembershipGuard } from '../guards/company-membership.guard';
import { RoleGuard } from '../guards/role.guard';

/* Zod validation pipe — validates request body against schema */
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';

/* Roles decorator — declares which roles can access a route */
import { Roles } from '../decorators/roles.decorator';

/* Zod schemas — runtime values used by ZodValidationPipe */
import {
  CreateCompanySchema,
  UpdateCompanySchema,
} from 'src/zod/company.zod';

/* DTO types — type-only imports (required by isolatedModules + emitDecoratorMetadata) */
import type {
  CreateCompanyDto,
  UpdateCompanyDto,
} from 'src/zod/company.zod';

/*
  All routes here are prefixed with /api/v1/companies
  (global prefix "api" + controller prefix "v1/companies")
*/
@Controller('v1/companies')
export class CompanyController {
  constructor(private readonly companyService: CompanyService) {}

  /*
    POST /api/v1/companies
    Create a new company.
    Only authenticated users can create.
    The creator automatically becomes OWNER.
  */
  @UseGuards(JwtAuthGuard)
  @Post()
  async createCompany(
    @Req() req,
    @Body(new ZodValidationPipe(CreateCompanySchema))
    body: CreateCompanyDto,
  ) {
    return this.companyService.createCompany(body, req.user.id);
  }

  /*
    GET /api/v1/companies/:companyId
    Get company details.
    Requires: JWT + active company membership.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard)
  @Get(':companyId')
  async getCompany(@Param('companyId') companyId: string) {
    return this.companyService.getCompanyById(companyId);
  }

  /*
    PATCH /api/v1/companies/:companyId
    Update company profile.
    Requires: JWT + membership + OWNER or ADMIN role.
  */
  @UseGuards(JwtAuthGuard, CompanyMembershipGuard, RoleGuard)
  @Roles('OWNER', 'ADMIN')
  @Patch(':companyId')
  async updateCompany(
    @Param('companyId') companyId: string,
    @Body(new ZodValidationPipe(UpdateCompanySchema))
    body: UpdateCompanyDto,
  ) {
    return this.companyService.updateCompany(companyId, body);
  }
}
