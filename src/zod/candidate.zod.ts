/*
  Candidate Zod schemas.

  Validates request bodies for candidate profile
  and resume management endpoints.

  z — Zod library for runtime validation.
*/
import { z } from 'zod';

/* ──────────────────────────────────────────────
   Candidate Profile Schemas
   ────────────────────────────────────────────── */

/*
  CreateCandidateProfileSchema — validates body when
  creating a new candidate profile.

  full_name is required (min 2 chars).
  All other fields are optional strings.
*/
export const CreateCandidateProfileSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  bio: z.string().optional(),
  photo_url: z.string().optional(),
  linkedin_url: z.string().optional(),
  portfolio_url: z.string().optional(),
  phone: z.string().max(50).optional(),
});

/*
  UpdateCandidateProfileSchema — all fields optional.
  .partial() makes every field optional.
*/
export const UpdateCandidateProfileSchema =
  CreateCandidateProfileSchema.partial();

/*
  TypeScript types inferred from schemas.
*/
export type CreateCandidateProfileDto = z.infer<
  typeof CreateCandidateProfileSchema
>;
export type UpdateCandidateProfileDto = z.infer<
  typeof UpdateCandidateProfileSchema
>;

/* ──────────────────────────────────────────────
   Resume Schemas
   ────────────────────────────────────────────── */

/*
  CreateResumeSchema — validates body when uploading a resume.

  file_url is required (URL to stored file).
  title is optional label for the resume.
  is_primary — if true, this becomes the default resume.
*/
export const CreateResumeSchema = z.object({
  title: z.string().max(255).optional(),
  file_url: z.string().min(1, 'File URL is required'),
  is_primary: z.boolean().default(false),
});

/*
  UpdateResumeSchema — partial update allowed.
*/
export const UpdateResumeSchema = CreateResumeSchema.partial();

/*
  TypeScript types inferred from schemas.
*/
export type CreateResumeDto = z.infer<typeof CreateResumeSchema>;
export type UpdateResumeDto = z.infer<typeof UpdateResumeSchema>;
