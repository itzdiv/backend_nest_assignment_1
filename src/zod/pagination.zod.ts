/*
  Pagination Zod schema.

  Used across ALL list endpoints to validate
  ?page=1&limit=10 query parameters.

  z — Zod library, provides schema definition and validation.
*/
import { z } from 'zod';

/*
  PaginationSchema validates query params.

  z.coerce.number() — coerces string query params to number.
  .int()           — must be integer (no 1.5).
  .min(1)          — minimum value is 1.
  .default(1)      — if not provided, defaults to 1.
*/
export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

/*
  TypeScript type inferred from the schema.
  Equivalent to: { page: number; limit: number }
*/
export type PaginationDto = z.infer<typeof PaginationSchema>;
