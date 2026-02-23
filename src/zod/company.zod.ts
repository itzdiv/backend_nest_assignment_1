/*
  Company Zod schemas.

  Validates request bodies for company CRUD operations.
  z — Zod library for runtime schema validation.
*/
import { z } from 'zod';

/*
  CreateCompanySchema — validates body when creating a new company.

  name: required, minimum 2 characters.
  description: optional text.
  logo_url: optional valid URL string.
  website: optional valid URL string.
*/
export const CreateCompanySchema = z.object({
  name: z.string().min(2, 'Company name must be at least 2 characters'),
  description: z.string().optional(),
  logo_url: z.string().optional(),
  website: z.string().optional(),
});

/*
  UpdateCompanySchema — validates body for updating

  .partial() makes every field optional so
  callers can send only the fields they want to change.
*/
export const UpdateCompanySchema = CreateCompanySchema.partial();

/*
  TypeScript types inferred from schemas.
  Used as DTOs in services and controllers.
*/
export type CreateCompanyDto = z.infer<typeof CreateCompanySchema>;
export type UpdateCompanyDto = z.infer<typeof UpdateCompanySchema>;
