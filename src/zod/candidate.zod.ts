import { z } from 'zod';

// ── Candidate Profile Schemas ──

export const CreateCandidateProfileSchema = z.object({
  full_name: z.string().min(2, 'Full name must be at least 2 characters'),
  bio: z.string().optional(),
  photo_url: z.string().optional(),
  linkedin_url: z.string().optional(),
  portfolio_url: z.string().optional(),
  phone: z.string().max(50).optional(),
});

export const UpdateCandidateProfileSchema =
  CreateCandidateProfileSchema.partial();

export type CreateCandidateProfileDto = z.infer<typeof CreateCandidateProfileSchema>;
export type UpdateCandidateProfileDto = z.infer<typeof UpdateCandidateProfileSchema>;

// ── Resume Schemas ──
// Only text fields validated here; the file itself is handled by Multer.

export const CreateResumeSchema = z.object({
  title: z.string().max(255).optional(),
  is_primary: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .transform((val) => val === true || val === 'true')
    .optional()
    .default(false),
});

export const UpdateResumeSchema = CreateResumeSchema.partial();

export type CreateResumeDto = z.infer<typeof CreateResumeSchema>;
export type UpdateResumeDto = z.infer<typeof UpdateResumeSchema>;
