/*
  API Module.

  This is the main feature module that registers all:
  - Entity repositories (via TypeOrmModule.forFeature)
  - Controllers (HTTP route handlers)
  - Services (business logic providers)
  - Guards (authentication & authorization)

  NestJS Module — groups related controllers, services,
  and imports into a cohesive unit.
*/

/* Module — NestJS decorator to define a module */
import { Module } from '@nestjs/common';

/* TypeOrmModule — registers entity repositories for dependency injection */
import { TypeOrmModule } from '@nestjs/typeorm';

/* ──────────────────────────────────────────────
   Entity imports — each maps to a PostgreSQL table
   ────────────────────────────────────────────── */
import { User } from '../db/entities/user.entity';
import { CandidateProfile } from '../db/entities/candidate-profile.entity';
import { Resume } from '../db/entities/resume.entity';
import { Company } from '../db/entities/company.entity';
import { CompanyMember } from '../db/entities/company-member.entity';
import { QuestionBank } from '../db/entities/question-bank.entity';
import { JobListing } from '../db/entities/job-listing.entity';
import { JobApplication } from '../db/entities/job-application.entity';
import { ApplicationComment } from '../db/entities/application-comment.entity';

/* ──────────────────────────────────────────────
   Controller imports — handle HTTP requests
   ────────────────────────────────────────────── */
import { AuthController } from './controllers/auth.controller';
import { CompanyController } from './controllers/company.controller';
import { MemberController } from './controllers/member.controller';
import { QuestionBankController } from './controllers/question-bank.controller';
import { JobController, PublicJobController } from './controllers/job.controller';
import { CandidateController } from './controllers/candidate.controller';
import { ResumeController } from './controllers/resume.controller';
import {
  CandidateApplicationController,
  CompanyApplicationController,
} from './controllers/application.controller';

/* ──────────────────────────────────────────────
   Service imports — contain business logic
   ────────────────────────────────────────────── */
import { AuthService } from './services/auth.service';
import { CompanyService } from './services/company.service';
import { MemberService } from './services/member.service';
import { QuestionBankService } from './services/question-bank.service';
import { JobService } from './services/job.service';
import { CandidateService } from './services/candidate.service';
import { ResumeService } from './services/resume.service';
import { ApplicationService } from './services/application.service';

/* ──────────────────────────────────────────────
   Guard imports — protect routes
   ────────────────────────────────────────────── */

/* JwtAuthGuard — verifies JWT token and attaches user to request */
import { JwtAuthGuard } from './guards/jwt-auth.guard';

/* CompanyMembershipGuard — verifies user belongs to company */
import { CompanyMembershipGuard } from './guards/company-membership.guard';

/* RoleGuard — checks user has required role (OWNER/ADMIN/RECRUITER) */
import { RoleGuard } from './guards/role.guard';

@Module({
  imports: [
    /*
      TypeOrmModule.forFeature() registers entity repositories.
      This makes Repository<Entity> injectable in services via @InjectRepository().
      Each entity maps to a PostgreSQL table.
    */
    TypeOrmModule.forFeature([
      User,
      CandidateProfile,
      Resume,
      Company,
      CompanyMember,
      QuestionBank,
      JobListing,
      JobApplication,
      ApplicationComment,
    ]),
  ],

  controllers: [
    /* Auth — register, login */
    AuthController,

    /* Company — create, get, update company */
    CompanyController,

    /* Members — invite, list, role change, revoke, transfer ownership */
    MemberController,

    /* Question Banks — CRUD for screening question templates */
    QuestionBankController,

    /* Jobs — CRUD for job listings (company-scoped) */
    JobController,

    /* Public Jobs — browse public active jobs (candidate-facing) */
    PublicJobController,

    /* Candidate Profile — create, get, update profile */
    CandidateController,

    /* Resumes — upload, list, set primary, delete */
    ResumeController,

    /* Candidate Applications — apply, view own, withdraw */
    CandidateApplicationController,

    /* Company Applications — view, accept/reject, comments */
    CompanyApplicationController,
  ],

  providers: [
    /* Services — all business logic providers */
    AuthService,
    CompanyService,
    MemberService,
    QuestionBankService,
    JobService,
    CandidateService,
    ResumeService,
    ApplicationService,

    /* Guards — registered as providers so NestJS can inject dependencies */
    JwtAuthGuard,
    CompanyMembershipGuard,
    RoleGuard,
  ],

  exports: [],
})
export class ApiModule {}
