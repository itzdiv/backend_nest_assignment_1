/*
  Job Zod schemas.

  Validates request bodies for job listing CRUD operations.
  Also includes question bank and member invitation schemas
  since they are company-scoped.

  z — Zod library for runtime validation.
*/
import { z } from 'zod';

/* ──────────────────────────────────────────────
   Member Invitation Schema
   ────────────────────────────────────────────── */

/*
  InviteMemberSchema — validates body when inviting
  a new member to a company.

  email: must be valid email.
  role: must be one of OWNER, ADMIN, RECRUITER.
*/
export const InviteMemberSchema = z.object({
  email: z.string().email('Invalid email'),
  role: z.enum(['OWNER', 'ADMIN', 'RECRUITER']),
});

export type InviteMemberDto = z.infer<typeof InviteMemberSchema>;

/*
  UpdateMemberRoleSchema — validates body when changing
  a member's role. Only role field is needed.
*/
export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'RECRUITER']),
});

export type UpdateMemberRoleDto = z.infer<typeof UpdateMemberRoleSchema>;

/* ──────────────────────────────────────────────
   Question Bank Schemas
   ────────────────────────────────────────────── */

/*
  QuestionItemSchema — single question inside a question bank.

  id: UUID string identifier for this question.
  question: the question text.
  category: grouping label (e.g. "python", "sql").
  type: one of text | number | boolean | choice.
  options: required array of strings ONLY when type = "choice".
  is_required: whether candidate must answer.
*/
const QuestionItemSchema = z.object({
  id: z.string().min(1),
  question: z.string().min(1),
  category: z.string().optional(),
  type: z.enum(['text', 'number', 'boolean', 'choice']),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().default(true),
});

/*
  CreateQuestionBankSchema — validates body when
  creating a new question bank.

  name: human-readable label.
  questions_json: array of QuestionItemSchema objects.
*/
export const CreateQuestionBankSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  questions_json: z.array(QuestionItemSchema).min(1, 'At least one question required'),
});

export const UpdateQuestionBankSchema = CreateQuestionBankSchema.partial();

export type CreateQuestionBankDto = z.infer<typeof CreateQuestionBankSchema>;
export type UpdateQuestionBankDto = z.infer<typeof UpdateQuestionBankSchema>;

/* ──────────────────────────────────────────────
   Job Listing Schemas
   ────────────────────────────────────────────── */

/*
  CreateJobSchema — validates body when creating a new job listing.

  title, description are required.
  application_mode: how candidates apply (STANDARD, QUESTIONNAIRE, VIDEO).
  visibility: PUBLIC or PRIVATE.
  status: DRAFT, ACTIVE, CLOSED — defaults to DRAFT.
  application_deadline: optional ISO date string.
  question_bank_id: optional reference to question bank for screening.
*/
export const CreateJobSchema = z.object({
  title: z.string().min(2, 'Title must be at least 2 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  requirements: z.string().optional(),
  salary_range: z.string().max(100).optional(),
  location: z.string().max(255).optional(),
  employment_type: z.string().max(50).optional(),
  application_mode: z.enum(['STANDARD', 'QUESTIONNAIRE', 'VIDEO']).default('STANDARD'),
  visibility: z.enum(['PUBLIC', 'PRIVATE']).default('PUBLIC'),
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']).default('DRAFT'),
  application_deadline: z.string().datetime().optional(),
  question_bank_id: z.string().uuid().optional(),
});

/*
  UpdateJobSchema — all fields optional for partial updates.
*/
export const UpdateJobSchema = CreateJobSchema.partial();

/*
  UpdateJobStatusSchema — changing only the status field.
*/
export const UpdateJobStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ACTIVE', 'CLOSED']),
});

export type CreateJobDto = z.infer<typeof CreateJobSchema>;
export type UpdateJobDto = z.infer<typeof UpdateJobSchema>;
export type UpdateJobStatusDto = z.infer<typeof UpdateJobStatusSchema>;
