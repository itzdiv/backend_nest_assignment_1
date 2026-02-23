/*
  Application Zod schemas.

  Validates request bodies for job application
  and application comment endpoints.

  z — Zod library for runtime validation.
*/
import { z } from 'zod';

/* ──────────────────────────────────────────────
   Job Application Schemas
   ────────────────────────────────────────────── */

/*
  CreateApplicationSchema — validates body when
  a candidate applies to a job.

  job_id: UUID of the job listing.
  resume_id: UUID of the resume to attach.
  answers_json: optional JSON answers to screening questions.
  video_url: optional video URL (for VIDEO mode applications).
*/
export const CreateApplicationSchema = z.object({
  job_id: z.string().uuid('Invalid job ID'),
  resume_id: z.string().uuid('Invalid resume ID'),
  answers_json: z.any().optional(),
  video_url: z.string().optional(),
});

export type CreateApplicationDto = z.infer<typeof CreateApplicationSchema>;

/* ──────────────────────────────────────────────
   Application Status Update Schema
   ────────────────────────────────────────────── */

/*
  UpdateApplicationStatusSchema — validates body when
  a company member accepts or rejects an application.

  status: ACCEPTED or REJECTED only (WITHDRAWN is separate endpoint).
*/
export const UpdateApplicationStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'REJECTED']),
});

export type UpdateApplicationStatusDto = z.infer<
  typeof UpdateApplicationStatusSchema
>;

/* ──────────────────────────────────────────────
   Application Comment Schema
   ────────────────────────────────────────────── */

/*
  CreateCommentSchema — validates body when a company
  member adds a comment to an application.

  comment: the comment text (min 1 char to prevent empty comments).
  visible_to_candidate: if true, candidate can see this comment.
*/
export const CreateCommentSchema = z.object({
  comment: z.string().min(1, 'Comment cannot be empty'),
  visible_to_candidate: z.boolean().default(false),
});

export type CreateCommentDto = z.infer<typeof CreateCommentSchema>;
